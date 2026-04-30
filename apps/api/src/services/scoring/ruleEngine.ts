/**
 * Unified Evaluation Engine + TOPSIS Final Ranking
 *
 * runEvaluation() — single BullMQ job, runs on every submitted application:
 *   1. Mark as 'evaluating'
 *   2. Anomaly check: G-01..G-07 rule-based deductions + G-08 Isolation Forest
 *      → If any flag fires → 'anomaly_flagged' (terminal)
 *   3. Eligibility gates: active enrollment, no duplicate, approved course type
 *      → If any gate fails → 'not_shortlisted' (terminal)
 *   4. Rule scoring: domains A–F (45 SCORE rules) + G deductions
 *      → Stores merit_score, rule_need_score, integrity_adj, wsm_provisional
 *      → Status → 'evaluated'
 *
 * runTOPSIS() — admin-triggered batch, runs once after application window closes:
 *   - Reads all 'evaluated' apps for the program
 *   - Vector-normalises merit & need across the cohort (weights 0.35 / 0.65)
 *   - Closeness coefficient Ci × 100 + integrity_adj → composite_score
 *   - Status → 'scored'
 *
 * composite_score is ONLY set by TOPSIS. wsm_provisional is the intermediate
 * WSM result (0.35×merit + 0.65×need + integrity) stored for reference.
 */

import { prisma }              from '../../lib/prisma'
import { logger }              from '../../lib/logger'
import { mlClient }            from '../mlClient'
import { loadStudentData }     from './studentDataLoader'
import { evaluateRule, checkDeductionFired } from './ruleEvaluator'
import type { DbRule }         from './ruleEvaluator'

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Rule loader with program overrides ─────────────────────────────────────

async function loadRulesWithOverrides(programId: string): Promise<Map<string, DbRule>> {
  const [rules, overrides] = await Promise.all([
    prisma.eligibilityRule.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.programRuleOverride.findMany({
      where: { program_id: programId, is_active: true },
      select: { rule_id: true, override_value: true },
    }),
  ])

  const overrideMap = new Map<string, unknown>()
  for (const ov of overrides) {
    overrideMap.set(ov.rule_id, ov.override_value)
  }

  const ruleMap = new Map<string, DbRule>()
  for (const r of rules) {
    ruleMap.set(r.rule_code, {
      rule_code:         r.rule_code,
      rule_name:         r.rule_name,
      domain:            r.domain,
      rule_type:         r.rule_type,
      operator:          r.operator,
      condition_field:   r.condition_field ?? '',
      condition_field_2: r.condition_field_2 ?? null,
      default_value:     overrideMap.has(r.id) ? overrideMap.get(r.id) : r.default_value,
      score_pts:         Number(r.score_pts),
      score_bucket:      r.score_bucket,
      is_active:         r.is_active,
    })
  }

  return ruleMap
}

// ─── Main single-phase evaluation ───────────────────────────────────────────

export async function runEvaluation(applicationId: string): Promise<void> {
  // Step 1: Mark as evaluating
  await prisma.application.update({
    where: { id: applicationId },
    data:  { status: 'evaluating' },
  })
  await prisma.applicationStatusLog.create({
    data: {
      application_id: applicationId,
      from_status:    'submitted',
      to_status:      'evaluating',
      reason:         'Evaluation started',
    },
  })

  const app     = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { program: true },
  })
  const student = await loadStudentData(applicationId)
  const rules   = await loadRulesWithOverrides(app.program_id)

  // ── Step 2: Anomaly check (G-01..G-07 rule-based + G-08 Isolation Forest) ─

  const g08Rule  = rules.get('G-08')
  const gRules   = [...rules.values()].filter(r => r.domain === 'G' && r.rule_code !== 'G-08')

  const g_rules_fired: string[]      = []
  const g_rules_fired_names: string[] = []
  for (const rule of gRules) {
    if (checkDeductionFired(rule, student)) {
      g_rules_fired.push(rule.rule_code)
      g_rules_fired_names.push(rule.rule_name)
    }
  }

  let anomaly_score = 0.0
  let ml_flag       = false
  const g08Threshold = Number((g08Rule?.default_value as { threshold?: number })?.threshold ?? 0.65)

  try {
    const mlResult = await mlClient.detectAnomaly(student)
    anomaly_score  = mlResult.anomaly_score
    ml_flag        = anomaly_score >= g08Threshold
  } catch {
    logger.warn('[Evaluation] ML service unavailable — G-08 skipped')
  }

  const anomaly_flag    = g_rules_fired.length > 0 || ml_flag
  const anomaly_reasons = { g_rules_fired, ml_flag }

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      anomaly_score,
      anomaly_flag,
      anomaly_reasons,
      anomaly_checked_at: new Date(),
    },
  })

  if (anomaly_flag) {
    const reasons_arr: string[] = []
    if (ml_flag) reasons_arr.push('Isolation Forest Anomaly Detection')
    reasons_arr.push(...g_rules_fired_names)

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status:           'anomaly_flagged',
        rejection_reason: 'Anomaly flagged — data contradictions detected: ' + reasons_arr.join('; '),
      },
    })
    await prisma.applicationStatusLog.create({
      data: {
        application_id: applicationId,
        from_status:    'evaluating',
        to_status:      'anomaly_flagged',
        reason:         `G rules fired: [${g_rules_fired.join(', ')}] | ML: ${ml_flag} (score=${anomaly_score.toFixed(3)})`,
      },
    })
    await prisma.notification.create({
      data: {
        user_id:        student.user_id,
        application_id: applicationId,
        type:           'status_update',
        title:          'Application Flagged',
        message:        'Your application has been flagged due to contradictory data and cannot proceed.',
      },
    })
    return
  }

  // ── Step 3: Eligibility gates ──────────────────────────────────────────────

  // Gate A: Active enrollment
  if (student.enrollment_status !== 'active') {
    await failEligibility(applicationId, student.user_id, 'Student is not actively enrolled')
    return
  }

  // Gate B: No duplicate active application for the same program
  const duplicate = await prisma.application.findFirst({
    where: {
      program_id: app.program_id,
      user_id:    app.user_id,
      id:         { not: applicationId },
      status:     { notIn: ['draft', 'rejected', 'not_shortlisted', 'anomaly_flagged'] },
    },
  })
  if (duplicate) {
    await failEligibility(applicationId, student.user_id, 'An active application for this program already exists')
    return
  }

  // Gate C: Approved course type (from A-05 rule default_value)
  const courseRule     = rules.get('A-05')
  const approvedCourses = (courseRule?.default_value as { courses?: string[] })?.courses
  if (approvedCourses && approvedCourses.length > 0 && student.course_type && !approvedCourses.includes(student.course_type)) {
    await failEligibility(applicationId, student.user_id, `Course type "${student.course_type}" is not approved for this program`)
    return
  }

  // ── Step 4: Rule scoring (domains A–F + G deductions) ──────────────────────

  const domainScores: Record<string, Record<string, number>> = {
    A: {}, B: {}, C: {}, D: {}, E: {}, F: {}, G: {},
  }

  let merit_raw     = 0
  let need_raw      = 0
  let integrity_raw = 0

  const MERIT_DOMAINS  = new Set(['A'])
  const NEED_DOMAINS   = new Set(['B', 'C', 'D', 'E', 'F'])
  const DEDUCT_DOMAINS = new Set(['G'])

  for (const [code, rule] of rules) {
    if (!['A','B','C','D','E','F','G'].includes(rule.domain)) continue
    const pts = evaluateRule(rule, student)
    domainScores[rule.domain]![code] = round2(pts)

    if (MERIT_DOMAINS.has(rule.domain))       merit_raw     += pts
    else if (NEED_DOMAINS.has(rule.domain))   need_raw      += pts
    else if (DEDUCT_DOMAINS.has(rule.domain)) integrity_raw += pts
  }

  const merit_score     = clamp(merit_raw,     0,   100)
  const rule_need_score = clamp(need_raw,      0,   100)
  const integrity_adj   = clamp(integrity_raw, -40,   0)

  // WSM provisional — stored for reference; composite_score is TOPSIS-only
  const wsm_provisional = round2(clamp(
    0.35 * merit_score + 0.65 * rule_need_score + integrity_adj,
    0, 100
  ))

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      merit_score:      round2(merit_score),
      rule_need_score:  round2(rule_need_score),
      integrity_adj:    round2(integrity_adj),
      wsm_provisional,
      scored_at:        new Date(),
      status:           'evaluated',
    },
  })

  await prisma.applicationStatusLog.create({
    data: {
      application_id: applicationId,
      from_status:    'evaluating',
      to_status:      'evaluated',
      reason:         `Merit: ${round2(merit_score)} | Need: ${round2(rule_need_score)} | Integrity: ${round2(integrity_adj)} | WSM: ${wsm_provisional}`,
    },
  })

  await prisma.notification.create({
    data: {
      user_id:        student.user_id,
      application_id: applicationId,
      type:           'status_update',
      title:          'Application Received',
      message:        'Your application has been received and evaluated. Final composite ranking will be computed once the application window closes.',
    },
  })
}

// ─── Eligibility failure helper ──────────────────────────────────────────────

async function failEligibility(applicationId: string, userId: string, reason: string): Promise<void> {
  await prisma.application.update({
    where: { id: applicationId },
    data:  { status: 'not_shortlisted', rejection_reason: reason },
  })
  await prisma.applicationStatusLog.create({
    data: {
      application_id: applicationId,
      from_status:    'evaluating',
      to_status:      'not_shortlisted',
      reason,
    },
  })
  await prisma.notification.create({
    data: {
      user_id:        userId,
      application_id: applicationId,
      type:           'status_update',
      title:          'Application Ineligible',
      message:        `Your application did not meet eligibility requirements: ${reason}`,
    },
  })
}

// ─── TOPSIS Batch Ranking (admin-triggered after application window closes) ──

/**
 * TOPSIS: Technique for Order of Preference by Similarity to Ideal Solution.
 *
 * Admin triggers this once the application window closes. Reads all 'evaluated'
 * applications for the program, computes cohort-relative composite_score, and
 * transitions them to 'scored'.
 *
 * Algorithm (2-criterion: merit w=0.35, need w=0.65):
 *  Step 1  Build decision matrix X[i] = [merit_i, need_i]
 *  Step 2  Vector-normalise each column: r[i][j] = x[i][j] / √Σx[][j]²
 *  Step 3  Weight: v[i][j] = w[j] × r[i][j]
 *  Step 4  Ideal best A⁺[j] = max(v[][j])  Ideal worst A⁻[j] = min(v[][j])
 *  Step 5  d⁺[i] = ‖v[i] − A⁺‖   d⁻[i] = ‖v[i] − A⁻‖
 *  Step 6  Ci = d⁻[i] / (d⁺[i] + d⁻[i])   (0=worst, 1=best)
 *  Step 7  composite_score = clamp(Ci×100 + integrity_adj, 0, 100)
 *
 * Edge cases:
 *  - n = 1: single applicant → Ci = 1.0 (ideal by default)
 *  - All identical scores: norm factor = 0 → Ci = 0.5 for all
 */
export async function runTOPSIS(programId: string): Promise<void> {
  const apps = await prisma.application.findMany({
    where:  { program_id: programId, status: 'evaluated' },
    select: { id: true, merit_score: true, rule_need_score: true, integrity_adj: true },
  })

  if (apps.length === 0) {
    logger.warn(`[TOPSIS] No evaluated applications found for program ${programId}`)
    return
  }

  const n       = apps.length
  const weights = [0.35, 0.65]

  // Step 1: Decision matrix
  const X = apps.map(a => [
    Number(a.merit_score     ?? 0),
    Number(a.rule_need_score ?? 0),
  ])

  // Step 2: Vector normalisation — column √Σx²
  const normFactors = [0, 1].map(j =>
    Math.sqrt(X.reduce((sum, row) => sum + row[j]! ** 2, 0))
  )

  const R = X.map(row =>
    row.map((val, j) => normFactors[j]! > 0 ? val / normFactors[j]! : 0)
  )

  // Step 3: Weighted normalised matrix
  const V = R.map(row => row.map((val, j) => weights[j]! * val))

  // Step 4: Ideal best (A⁺) and ideal worst (A⁻) — both criteria are benefit
  const Aplus  = [0, 1].map(j => Math.max(...V.map(row => row[j]!)))
  const Aminus = [0, 1].map(j => Math.min(...V.map(row => row[j]!)))

  // Step 5: Euclidean distances
  const dPlus  = V.map(row => Math.sqrt(row.reduce((s, v, j) => s + (v - Aplus[j]!)  ** 2, 0)))
  const dMinus = V.map(row => Math.sqrt(row.reduce((s, v, j) => s + (v - Aminus[j]!) ** 2, 0)))

  // Step 6: Closeness coefficient Ci
  const Ci = dPlus.map((dp, i) => {
    const denom = dp + dMinus[i]!
    if (denom === 0) return 0.5  // all applicants identical — tie at 0.5
    return dMinus[i]! / denom
  })

  // Step 7: Scale + integrity deduction → final composite_score
  const scored = apps.map((app, i) => {
    const topsis_base     = Ci[i]! * 100
    const integrity       = Number(app.integrity_adj ?? 0)
    const composite_score = round2(clamp(topsis_base + integrity, 0, 100))
    return { id: app.id, composite_score }
  })

  // Sort descending to assign composite_rank (1 = best)
  scored.sort((a, b) => b.composite_score - a.composite_score)

  const updates = scored.map((s, i) =>
    prisma.application.update({
      where: { id: s.id },
      data:  { composite_score: s.composite_score, composite_rank: i + 1, status: 'scored' },
    })
  )

  await Promise.all(updates)
  logger.info(`[TOPSIS] Ranked ${n} applications for program ${programId}`)
}

// ─── Post-verification composite multiplier (I domain) ──────────────────────

/**
 * Applies I-02 / I-03 / I-04 multiplier after field verification.
 * match_score = verifier's yes_count / total_fields × 100
 * anomaly_flag forces I-03 regardless of match_score.
 */
export async function applyVerificationMultiplier(
  applicationId: string,
  programId: string,
): Promise<void> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      verification_assignment: {
        include: { field_reports: true },
      },
    },
  })

  const fieldReports = app.verification_assignment?.field_reports
  const report = Array.isArray(fieldReports) ? fieldReports[0] : fieldReports
  if (!report) return

  const rules     = await loadRulesWithOverrides(programId)
  const match     = Number(report.match_score ?? 0)
  const composite = Number(app.composite_score ?? 0)

  const i02 = rules.get('I-02')
  const i03 = rules.get('I-03')
  const i04 = rules.get('I-04')

  const highThreshold = Number((i02?.default_value as { match_gte?: number })?.match_gte ?? 80)
  const lowThreshold  = Number((i04?.default_value as { match_lt?: number })?.match_lt  ?? 50)
  const highMult      = Number((i02?.default_value as { multiplier?: number })?.multiplier ?? 1.0)
  const midMult       = Number((i03?.default_value as { multiplier?: number })?.multiplier ?? 0.85)
  const lowMult       = Number((i04?.default_value as { multiplier?: number })?.multiplier ?? 0.50)

  let multiplier = highMult
  if (match < lowThreshold) {
    multiplier = lowMult
  } else if (match < highThreshold || app.anomaly_flag) {
    multiplier = midMult
  }

  const post_verify_composite = clamp(composite * multiplier, 0, 100)

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      verification_match_score: match,
      post_verify_composite:    round2(post_verify_composite),
      status:                   'verification_complete',
    },
  })
}

// ─── Legacy: kept for any external imports still using old name ───────────────
export { runEvaluation as runScoringEngine }
