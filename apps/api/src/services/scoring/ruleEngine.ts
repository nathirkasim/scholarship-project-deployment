/**
 * Unified Evaluation Engine + TOPSIS Final Ranking
 *
 * runEvaluation() — single BullMQ job, runs on every submitted application:
 *   1. Mark as 'evaluating'
 *   2. Anomaly check: G-01..G-07 rule-based deductions + G-08 Isolation Forest
 *      → If any flag fires → 'rejected' (terminal, auto, reason stored)
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
import type { ApplicationStatus } from '@prisma/client'

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

// ─── Anomaly rejection reason builder ───────────────────────────────────────

function buildAnomalyRejectionReason(
  g_rules_fired: string[],
  ml_flag: boolean,
  _anomaly_score: number,
): string {
  const RULE_REASONS: Record<string, string> = {
    'G-01': 'Income and vehicle asset details do not match.',
    'G-02': 'Income and electronics asset details do not match.',
    'G-03': 'Income and gold or jewellery details do not match.',
    'G-04': 'Income and savings or fixed deposit details do not match.',
    'G-05': 'Housing condition and total asset value appear inconsistent.',
    'G-06': 'Housing type and land ownership details are contradictory.',
    'G-07': 'Income level is inconsistent with the government benefits declared.',
  }

  const points: string[] = g_rules_fired.map(code => RULE_REASONS[code]).filter(Boolean) as string[]
  if (ml_flag) points.push('Overall application data contains unusual patterns.')

  if (points.length === 0) {
    return 'Your application could not be processed due to inconsistencies in the submitted information. Please contact the Scholarship Helpdesk if you need assistance.'
  }

  const body = points.map((p, i) => `${i + 1}. ${p}`).join('\n')
  return `Your application was not processed because the following information appears inconsistent:\n\n${body}\n\nPlease contact the Scholarship Helpdesk if you believe this is an error.`
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
    const rejection_reason = buildAnomalyRejectionReason(g_rules_fired, ml_flag, anomaly_score)
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status:           'anomaly_flagged',
        final_decision:   'rejected',
        rejection_reason,
        decided_at:       new Date(),
      },
    })
    await prisma.applicationStatusLog.create({
      data: {
        application_id: applicationId,
        from_status:    'evaluating',
        to_status:      'anomaly_flagged',
        reason:         `G rules fired: [${g_rules_fired.join(', ')}] | ML: ${ml_flag} (score=${anomaly_score.toFixed(3)}) | Names: ${g_rules_fired_names.join('; ')}`,
      },
    })
    await prisma.notification.create({
      data: {
        user_id:        student.user_id,
        application_id: applicationId,
        type:           'status_update',
        title:          'Application Not Processed — Please Review Your Details',
        message:        'Your application could not be processed because some information you entered appears inconsistent. Please log in to see the specific reason and contact the Scholarship Helpdesk if you need help.',
      },
    })
    return
  }

  // ── Step 3: Eligibility gates ──────────────────────────────────────────────

  // Gate A: Active enrollment
  if (student.enrollment_status !== 'active') {
    await failEligibility(applicationId, student.user_id, 'Your application could not be accepted as your enrolment status is currently not active. This scholarship is open only to students who are actively enrolled and attending classes. Please update your enrolment records and try again in the next cycle.')
    return
  }

  // Gate B: No duplicate active application for the same program
  const duplicate = await prisma.application.findFirst({
    where: {
      program_id: app.program_id,
      user_id:    app.user_id,
      id:         { not: applicationId },
      status:     { notIn: ['draft', 'rejected', 'not_shortlisted'] },
    },
  })
  if (duplicate) {
    await failEligibility(applicationId, student.user_id, 'We already have an active application from you for this programme. As per the programme guidelines, only one application per student is allowed at a time. Please check the status of your existing application.')
    return
  }

  // Gate C: Approved course type (from A-05 rule default_value)
  const courseRule     = rules.get('A-05')
  const approvedCourses = (courseRule?.default_value as { courses?: string[] })?.courses
  if (approvedCourses && approvedCourses.length > 0 && student.course_type && !approvedCourses.includes(student.course_type)) {
    await failEligibility(applicationId, student.user_id, 'Your current course of study is not covered under the list of approved courses for this scholarship programme. Please refer to the programme guidelines for the list of eligible courses and feel free to apply if your course qualifies in a future cycle.')
    return
  }

  // Gate D: Full-time study mode (A-04)
  if (student.study_mode && student.study_mode !== 'full_time') {
    await failEligibility(applicationId, student.user_id, 'This scholarship is currently available only for full-time students. Students enrolled in part-time or distance education programmes are not eligible under the current guidelines. We encourage you to check back for future programmes that may be applicable.')
    return
  }

  // Gate E: Not receiving another scholarship (A-07)
  if (student.receiving_other_scholarship === true) {
    await failEligibility(applicationId, student.user_id, 'As per the programme guidelines, students who are currently receiving financial assistance from another scholarship are not eligible to apply. This ensures equitable distribution of resources among all deserving candidates.')
    return
  }

  // Gate F: Not previously awarded by this Trust (A-08)
  if (student.prev_awarded_by_trust === true) {
    await failEligibility(applicationId, student.user_id, 'Our records indicate that you have previously been awarded a scholarship by this Trust. To ensure fair access for all students, this programme gives priority to first-time applicants. We appreciate your continued interest and wish you the best in your academic journey.')
    return
  }

  // Gate G: Maximum arrears limit (A-03) — more than 5 active arrears disqualifies
  if (student.active_arrears != null && student.active_arrears > 5) {
    await failEligibility(applicationId, student.user_id, 'Your application could not be accepted as the number of pending academic arrears exceeds the permissible limit for this programme. We recommend clearing outstanding subjects and applying again in the next scholarship cycle.')
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

  // ── Auto-advance: if all pending evaluations are done, run TOPSIS + verification ──
  try {
    await autoAdvancePipeline(app.program_id)
  } catch (err) {
    logger.warn(`[Evaluation] Auto-advance failed for program ${app.program_id}: ${err}`)
  }
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
      title:          'Application Not Eligible',
      message:        reason,
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
// Statuses that have been through scoring and should be included in cohort ranking
const RANKABLE_STATUSES = ['evaluated', 'scored', 'verification_pending', 'verification_complete', 'approved', 'waitlisted'] as const

export async function runTOPSIS(programId: string): Promise<void> {
  const apps = await prisma.application.findMany({
    where:  { program_id: programId, status: { in: [...RANKABLE_STATUSES] }, merit_score: { not: null } },
    select: { id: true, status: true, merit_score: true, rule_need_score: true, integrity_adj: true },
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

  const appStatusMap = new Map(apps.map(a => [a.id, a.status]))

  const updates = scored.map((s, i) => {
    const currentStatus = appStatusMap.get(s.id)
    return prisma.application.update({
      where: { id: s.id },
      data:  {
        composite_score: s.composite_score,
        composite_rank:  i + 1,
        // Only advance status from 'evaluated' → 'scored'; leave all later stages as-is
        ...(currentStatus === 'evaluated' ? { status: 'scored' } : {}),
      },
    })
  })

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

  // I-04: match < 50% → auto-reject (declared data contradicted by field visit)
  if (match < lowThreshold) {
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        verification_match_score: match,
        post_verify_composite:    round2(clamp(composite * lowMult, 0, 100)),
        status:                   'rejected',
        final_decision:           'rejected',
        decided_at:               new Date(),
        rejection_reason:         'During the field verification process, the information provided in your application could not be satisfactorily verified. As a result, your application has been declined. Please contact the scholarship office if you wish to seek clarification.',
      },
    })
    await prisma.applicationStatusLog.create({
      data: {
        application_id: applicationId,
        from_status:    'verification_pending',
        to_status:      'rejected',
        reason:         `I-04: match_score ${match.toFixed(1)}% < ${lowThreshold}% threshold — auto-rejected`,
      },
    })
    return
  }

  let multiplier = highMult
  if (match < highThreshold || app.anomaly_flag) {
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

// ─── Auto-advance pipeline ──────────────────────────────────────────────────

/**
 * Checks whether all submitted/evaluating applications for a program have
 * finished evaluation. If so, automatically runs:
 *   1. TOPSIS batch ranking (all evaluated → scored)
 *   2. selectForVerification (top 2×seats → verification_pending + verifier assignment)
 *
 * Safe to call after every evaluation — it's a no-op if pending work remains.
 */
export async function autoAdvancePipeline(programId: string): Promise<void> {
  // Check if any applications are still pending evaluation
  const pendingCount = await prisma.application.count({
    where: {
      program_id: programId,
      status: { in: ['submitted', 'evaluating'] },
    },
  })

  if (pendingCount > 0) {
    logger.info(`[AutoAdvance] ${pendingCount} applications still pending for program ${programId} — skipping`)
    return
  }

  // Check if there are evaluated apps that need TOPSIS
  const evaluatedCount = await prisma.application.count({
    where: { program_id: programId, status: 'evaluated' },
  })

  if (evaluatedCount === 0) {
    // All apps are already scored or beyond — nothing to do
    return
  }

  logger.info(`[AutoAdvance] All evaluations complete for program ${programId}. Running TOPSIS...`)

  // Step 1: Run TOPSIS ranking
  await runTOPSIS(programId)

  // Step 2: Auto-select top candidates for verification
  await selectForVerification(programId)

  logger.info(`[AutoAdvance] Pipeline complete for program ${programId}`)
}

// ─── Verification selection (shared by auto + manual flows) ──────────────────

/**
 * Selects top N scored applications (2× total_seats) for field verification.
 * Moves them to 'verification_pending' and assigns verifiers round-robin.
 *
 * This is the shared logic used by both:
 *   - autoAdvancePipeline (automatic after last evaluation)
 *   - POST /api/officer/trigger-verification (manual admin re-run)
 */
export async function selectForVerification(programId: string): Promise<{ moved: number; verifiers: number }> {
  const program = await prisma.scholarshipProgram.findUniqueOrThrow({
    where: { id: programId },
  })

  const MIN_COMPOSITE_THRESHOLD = 40.0  // Applications below this are not viable candidates

  const limit = program.total_seats * 2
  const topApps = await prisma.application.findMany({
    where: { program_id: programId, status: 'scored', composite_score: { gte: MIN_COMPOSITE_THRESHOLD } },
    orderBy: { composite_score: 'desc' },
    take: limit,
    select: { id: true, anomaly_score: true, composite_score: true, user_id: true },
  })

  // Auto-reject applications that scored below the minimum threshold
  const belowThreshold = await prisma.application.findMany({
    where: { program_id: programId, status: 'scored', composite_score: { lt: MIN_COMPOSITE_THRESHOLD } },
    select: { id: true, user_id: true, composite_score: true },
  })
  if (belowThreshold.length > 0) {
    await prisma.application.updateMany({
      where: { id: { in: belowThreshold.map(a => a.id) } },
      data: {
        status: 'rejected',
        final_decision: 'rejected',
        rejection_reason: 'Thank you for your application. After careful evaluation, your application does not meet the minimum eligibility requirements for this scholarship programme. We encourage you to apply again in the next academic year.',
        decided_at: new Date(),
      },
    })
    await Promise.all(
      belowThreshold.map(a =>
        prisma.applicationStatusLog.create({
          data: {
            application_id: a.id,
            from_status: 'scored',
            to_status: 'rejected',
            reason: `Composite score ${Number(a.composite_score).toFixed(1)} below minimum threshold ${MIN_COMPOSITE_THRESHOLD}`,
          },
        })
      )
    )
    logger.info(`[Verification] ${belowThreshold.length} applications auto-rejected (below ${MIN_COMPOSITE_THRESHOLD} threshold)`)
  }

  if (topApps.length === 0) {
    logger.info(`[Verification] No scored applications to move for program ${programId}`)
    return { moved: 0, verifiers: 0 }
  }

  // Move to verification_pending
  await prisma.application.updateMany({
    where: { id: { in: topApps.map(a => a.id) } },
    data: { status: 'verification_pending' },
  })

  // Log status changes
  await Promise.all(
    topApps.map(a =>
      prisma.applicationStatusLog.create({
        data: {
          application_id: a.id,
          from_status:    'scored',
          to_status:      'verification_pending',
          reason:         'Auto-selected for field verification (top candidates by TOPSIS composite)',
        },
      })
    )
  )

  // Notify students
  await Promise.all(
    topApps.map(a =>
      prisma.notification.create({
        data: {
          user_id:        a.user_id,
          application_id: a.id,
          type:           'status_update',
          title:          'Field Verification Scheduled',
          message:        'You have been shortlisted for field verification. An authorised verifier will contact you shortly.',
        },
      })
    )
  )

  // Auto-assign verifiers round-robin (skip apps already assigned)
  const verifiers = await prisma.user.findMany({
    where: { role: 'verifier', is_active: true },
    select: { id: true },
    orderBy: { created_at: 'asc' },
  })

  if (verifiers.length > 0) {
    const existingAssignments = await prisma.verificationAssignment.findMany({
      where: { application_id: { in: topApps.map(a => a.id) } },
      select: { application_id: true },
    })
    const alreadyAssigned = new Set(existingAssignments.map(a => a.application_id))
    const unassigned = topApps.filter(a => !alreadyAssigned.has(a.id))

    // Priority: higher anomaly_score = verify sooner; then by composite score (matches stored priority_score formula)
    const sorted = [...unassigned].sort((a, b) => {
      const bScore = Number(b.anomaly_score ?? 0) * 0.6 + (Number(b.composite_score ?? 0) / 100) * 0.4
      const aScore = Number(a.anomaly_score ?? 0) * 0.6 + (Number(a.composite_score ?? 0) / 100) * 0.4
      return bScore - aScore
    })

    await Promise.all(
      sorted.map((app, i) =>
        prisma.verificationAssignment.upsert({
          where: { application_id: app.id },
          update: {},
          create: {
            application_id:        app.id,
            verifier_id:           verifiers[i % verifiers.length]!.id,
            assigned_at:           new Date(),
            status:                'pending',
            verification_priority: i + 1,
            priority_score:
              Number(app.anomaly_score ?? 0) * 0.6 +
              (Number(app.composite_score ?? 0) / 100) * 0.4,
          },
        })
      )
    )
  }

  logger.info(`[Verification] ${topApps.length} applications moved to verification_pending for program ${programId}`)
  return { moved: topApps.length, verifiers: verifiers.length }
}

// ─── Auto-finalize decisions after all verifications complete ────────────────

/**
 * Re-ranks ALL verified applications by post_verify_composite and writes final
 * decisions. Safe to call multiple times — idempotent, only sends notifications
 * when a decision changes.
 *
 * Pool: apps with post_verify_composite set AND match_score ≥ 50
 *   (match < 50 → already auto-rejected by I-04, kept excluded)
 * Includes already-decided apps so re-running always produces the correct ranking.
 *
 *   Top total_seats          → approved
 *   Next WAITLIST_SIZE (20)  → waitlisted
 *   Remaining                → rejected
 */
export async function autoFinalizeDecisions(programId: string): Promise<void> {
  // Collect ALL apps that went through field verification and weren't I-04 rejected.
  // I-04 auto-rejects have match_score < 50 — excluded via the OR condition.
  // Apps with null match_score (seeded directly as verification_complete) are included.
  const verifiedApps = await prisma.application.findMany({
    where: {
      program_id:            programId,
      post_verify_composite: { not: null },
      status:                { in: ['verification_complete', 'approved', 'waitlisted', 'rejected'] },
      OR: [
        { verification_match_score: null },       // seeded / manually set apps
        { verification_match_score: { gte: 50 } }, // normal flow (I-04 excluded)
      ],
    },
    select: {
      id:                    true,
      user_id:               true,
      post_verify_composite: true,
      final_decision:        true,
      status:                true,
    },
    orderBy: { post_verify_composite: 'desc' },
  })

  if (verifiedApps.length === 0) {
    logger.info(`[AutoFinalize] No verified applications found for program ${programId}`)
    return
  }

  const program = await prisma.scholarshipProgram.findUniqueOrThrow({
    where: { id: programId },
  })

  const seats         = program.total_seats  // default 50 — top N approved
  const WAITLIST_SIZE = 50                   // next 50 waitlisted

  // Only finalize once the verified pool is at least as large as the seat count.
  // This prevents premature decisions when only a handful of reports are in.
  if (verifiedApps.length < seats) {
    logger.info(
      `[AutoFinalize] Holding — only ${verifiedApps.length} verified so far, need ${seats} before finalising`
    )
    return
  }

  const now = new Date()

  // Re-write composite_rank for the full verified pool (1 = best post-verify score)
  await Promise.all(
    verifiedApps.map((a, i) =>
      prisma.application.update({
        where: { id: a.id },
        data:  { composite_rank: i + 1 },
      })
    )
  )

  const toApprove  = verifiedApps.slice(0, seats)
  const toWaitlist = verifiedApps.slice(seats, seats + WAITLIST_SIZE)
  const toReject   = verifiedApps.slice(seats + WAITLIST_SIZE)

  // Helper: determines the from_status for logging
  const fromStatus = (a: { status: string }): ApplicationStatus =>
    a.status as ApplicationStatus

  // Approve top N
  if (toApprove.length > 0) {
    await prisma.application.updateMany({
      where: { id: { in: toApprove.map(a => a.id) } },
      data:  { status: 'approved', final_decision: 'approved', decided_at: now },
    })
    await Promise.all(toApprove.flatMap((a, i) => {
      const ops: Promise<unknown>[] = [
        prisma.applicationStatusLog.create({
          data: {
            application_id: a.id,
            from_status:    fromStatus(a),
            to_status:      'approved',
            reason:         `Auto-approved: rank ${i + 1} / ${verifiedApps.length} — post-verify composite ${Number(a.post_verify_composite ?? 0).toFixed(1)}`,
          },
        }),
      ]
      // Only notify on first approval (avoid duplicate notifications on re-runs)
      if (a.final_decision !== 'approved') {
        ops.push(prisma.notification.create({
          data: {
            user_id:        a.user_id,
            application_id: a.id,
            type:           'status_update',
            title:          'Application Approved',
            message:        'Congratulations! Your application has been approved for the scholarship.',
          },
        }))
      }
      return ops
    }))
  }

  // Waitlist next 50
  if (toWaitlist.length > 0) {
    await prisma.application.updateMany({
      where: { id: { in: toWaitlist.map(a => a.id) } },
      data:  { status: 'waitlisted', final_decision: 'waitlisted', decided_at: now },
    })
    await Promise.all(toWaitlist.flatMap((a, i) => {
      const ops: Promise<unknown>[] = [
        prisma.applicationStatusLog.create({
          data: {
            application_id: a.id,
            from_status:    fromStatus(a),
            to_status:      'waitlisted',
            reason:         `Auto-waitlisted: rank ${seats + i + 1} / ${verifiedApps.length} — post-verify composite ${Number(a.post_verify_composite ?? 0).toFixed(1)}`,
          },
        }),
      ]
      if (a.final_decision !== 'waitlisted') {
        ops.push(prisma.notification.create({
          data: {
            user_id:        a.user_id,
            application_id: a.id,
            type:           'status_update',
            title:          'Application Waitlisted',
            message:        'Your application has been placed on the waitlist. You may be selected if a seat becomes available.',
          },
        }))
      }
      return ops
    }))
  }

  // Reject the remainder — encourage them to apply next year
  if (toReject.length > 0) {
    const rejectReason = 'Thank you for your application and participation in the field verification process. After a final review of all verified applications ranked by composite score, your application could not be selected for this programme.\n\nYou are welcome to apply again when the next academic year programme opens. We encourage you to strengthen your application and reapply.'
    await prisma.application.updateMany({
      where: { id: { in: toReject.map(a => a.id) } },
      data: {
        status:           'rejected',
        final_decision:   'rejected',
        decided_at:       now,
        rejection_reason: rejectReason,
      },
    })
    await Promise.all(toReject.flatMap((a, i) => {
      const ops: Promise<unknown>[] = [
        prisma.applicationStatusLog.create({
          data: {
            application_id: a.id,
            from_status:    fromStatus(a),
            to_status:      'rejected',
            reason:         `Auto-rejected: rank ${seats + WAITLIST_SIZE + i + 1} / ${verifiedApps.length} — post-verify composite ${Number(a.post_verify_composite ?? 0).toFixed(1)}`,
          },
        }),
      ]
      if (a.final_decision !== 'rejected') {
        ops.push(prisma.notification.create({
          data: {
            user_id:        a.user_id,
            application_id: a.id,
            type:           'status_update',
            title:          'Application Not Selected — Apply Next Year',
            message:        'Thank you for your application. After a final review, your application was not selected for this programme. We encourage you to apply again when the next academic year programme opens.',
          },
        }))
      }
      return ops
    }))
  }

  logger.info(
    `[AutoFinalize] Program ${programId}: ${toApprove.length} approved, ` +
    `${toWaitlist.length} waitlisted, ${toReject.length} rejected ` +
    `(total verified pool: ${verifiedApps.length})`
  )
}

// ─── Legacy: kept for any external imports still using old name ───────────────
export { runEvaluation as runScoringEngine }

