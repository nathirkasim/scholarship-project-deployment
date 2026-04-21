/**
 * Phase 3  DB-Driven Single-Pass Rule Engine + TOPSIS Final Ranking
 * 
 * 1. Loads all active rules from DB for the program
 * 2. Applies program_rule_overrides (per-program threshold customisation)
 * 3. Evaluates all 45 SCORE rules (domains AF) in one pass
 * 4. Applies G-domain deductions (G-01..G-07 from current student data)
 * 5. Stores merit_score, rule_need_score, integrity_adj  status 'scored'
 * 6. After ALL applications in the program are scored, runTOPSIS()
 *    replaces WSM composite with a TOPSIS closeness-coefficient score:
 *    - Vector-normalises merit & need across the cohort
 *    - Applies weights [w=0.35 merit, w=0.65 need]
 *    - Computes Ci = d / (d + d)    topsis_base = Ci  100
 *    - composite_score = clamp(topsis_base + integrity_adj, 0, 100)
 *
 * TOPSIS (H-05) replaces WSM for final ranking  every point is still
 * traceable to a named rule; TOPSIS adds cohort-relative normalisation.
 * XGBoost blend (H-03) remains deactivated.
 * Isolation Forest runs in Phase 1 only (auto-reject).
 */

import { prisma }              from '../../lib/prisma'
import { logger }              from '../../lib/logger'
import { loadStudentData }     from './studentDataLoader'
import { evaluateRule }        from './ruleEvaluator'
import type { DbRule }         from './ruleEvaluator'
import type { ScoreResult }    from '../../types/student'

//  Helpers 

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

//  Rule loader with program overrides 

/**
 * Loads all active rules for a program from DB.
 * Merges program_rule_overrides on top  override wins over global default_value.
 * Returns a map of rule_code  DbRule with effective default_value applied.
 */
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
    const effectiveDefaultValue = overrideMap.has(r.id)
      ? overrideMap.get(r.id)
      : r.default_value

    ruleMap.set(r.rule_code, {
      rule_code:         r.rule_code,
      rule_name:         r.rule_name,
      domain:            r.domain,
      rule_type:         r.rule_type,
      operator:          r.operator,
      condition_field:   r.condition_field ?? '',
      condition_field_2: r.condition_field_2 ?? null,
      default_value:     effectiveDefaultValue,
      score_pts:         Number(r.score_pts),
      score_bucket:      r.score_bucket,
      is_active:         r.is_active,
    })
  }

  return ruleMap
}

//  Main scoring function 

export async function runScoringEngine(applicationId: string): Promise<ScoreResult> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { program: true },
  })

  const student = await loadStudentData(applicationId)
  const rules   = await loadRulesWithOverrides(app.program_id)

  //  Single-pass evaluation 
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

  //  H-05 (provisional): WSM composite stored now; overwritten by TOPSIS
  //    after all applications in this program are scored (see runTOPSIS).
  const provisional_composite = clamp(
    0.35 * merit_score + 0.65 * rule_need_score + integrity_adj,
    0, 100
  )

  const result: ScoreResult = {
    merit_score:      round2(merit_score),
    rule_need_score:  round2(rule_need_score),
    integrity_adj:    round2(integrity_adj),
    composite_score:  round2(provisional_composite),
    score_breakdown: {
      domain_a: domainScores['A']!,
      domain_b: domainScores['B']!,
      domain_c: domainScores['C']!,
      domain_d: domainScores['D']!,
      domain_e: domainScores['E']!,
      domain_f: domainScores['F']!,
      domain_g: domainScores['G']!,
    },
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      merit_score:     result.merit_score,
      rule_need_score: result.rule_need_score,
      integrity_adj:   result.integrity_adj,
      composite_score: result.composite_score,
      scored_at:       new Date(),
      status:          'scored',
    },
  })

  await prisma.applicationStatusLog.create({
    data: {
      application_id: applicationId,
      from_status:    'shortlisted',
      to_status:      'scored',
      reason:         `Merit: ${result.merit_score} | Need: ${result.rule_need_score} | Integrity: ${result.integrity_adj} | Provisional: ${result.composite_score}`,
    },
  })

  await prisma.notification.create({
    data: {
      user_id:        student.user_id,
      application_id: applicationId,
      type:           'status_update',
      title:          'Application Evaluated',
      message:        `Your application has been evaluated. Final TOPSIS composite score will be computed once all applications are processed. Check your score card for updates.`,
    },
  })

  return result
}

//  TOPSIS Batch Ranking (H-05  final composite) 

/**
 * TOPSIS: Technique for Order of Preference by Similarity to Ideal Solution.
 *
 * Runs as a batch step after ALL shortlisted applications in a program are
 * individually scored. Replaces the provisional WSM composite_score with a
 * cohort-relative TOPSIS closeness coefficient.
 *
 * Algorithm (2-criterion: merit w=0.35, need w=0.65):
 *  Step 1  Build decision matrix X[i] = [merit_i, need_i]
 *  Step 2  Vector-normalise each column:  r[i][j] = x[i][j] / column_j
 *  Step 3  Weight: v[i][j] = w[j]  r[i][j]
 *  Step 4  Ideal best  A[j] = max(v[][j])   (both criteria are benefit)
 *          Ideal worst A[j] = min(v[][j])
 *  Step 5  d[i] = v[i]  A    d[i] = v[i]  A
 *  Step 6  Ci = d[i] / (d[i] + d[i])     (0 = worst, 1 = best)
 *  Step 7  composite_score = clamp(Ci  100 + integrity_adj, 0, 100)
 *
 * Edge cases:
 *  - n = 1 : single applicant  Ci = 1.0 (ideal by default)
 *  - All identical scores  norm factor = 0  Ci = 0.5 for all
 */
export async function runTOPSIS(programId: string): Promise<void> {
  const apps = await prisma.application.findMany({
    where:  { program_id: programId, status: 'scored' },
    select: { id: true, merit_score: true, rule_need_score: true, integrity_adj: true },
  })

  if (apps.length === 0) return

  const n       = apps.length
  const weights = [0.35, 0.65] // [merit, need]

  // Step 1: Decision matrix
  const X = apps.map(a => [
    Number(a.merit_score     ?? 0),
    Number(a.rule_need_score ?? 0),
  ])

  // Step 2: Vector normalisation  column_j
  const normFactors = [0, 1].map(j =>
    Math.sqrt(X.reduce((sum, row) => sum + row[j]! ** 2, 0))
  )

  const R = X.map(row =>
    row.map((val, j) => normFactors[j]! > 0 ? val / normFactors[j]! : 0)
  )

  // Step 3: Weighted normalised matrix
  const V = R.map(row => row.map((val, j) => weights[j]! * val))

  // Step 4: Ideal best (A) and ideal worst (A)  both benefit criteria
  const Aplus  = [0, 1].map(j => Math.max(...V.map(row => row[j]!)))
  const Aminus = [0, 1].map(j => Math.min(...V.map(row => row[j]!)))

  // Step 5: Euclidean distances
  const dPlus  = V.map(row => Math.sqrt(row.reduce((s, v, j) => s + (v - Aplus[j]!)  ** 2, 0)))
  const dMinus = V.map(row => Math.sqrt(row.reduce((s, v, j) => s + (v - Aminus[j]!) ** 2, 0)))

  // Step 6: Closeness coefficient Ci
  const Ci = dPlus.map((dp, i) => {
    const denom = dp + dMinus[i]!
    if (denom === 0) return 0.5   // all applicants identical  tie at 0.5
    return dMinus[i]! / denom
  })

  // Step 7: Scale + integrity deduction  final composite_score
  const scored = apps.map((app, i) => {
    const topsis_base    = Ci[i]! * 100
    const integrity      = Number(app.integrity_adj ?? 0)
    const composite_score = round2(clamp(topsis_base + integrity, 0, 100))
    return { id: app.id, composite_score }
  })

  // Sort descending to assign composite_rank (1 = best)
  scored.sort((a, b) => b.composite_score - a.composite_score)

  const updates = scored.map((s, i) =>
    prisma.application.update({
      where: { id: s.id },
      data:  { composite_score: s.composite_score, composite_rank: i + 1 },
    })
  )

  await Promise.all(updates)
  logger.info(`[TOPSIS] Computed composite scores for ${n} applications in program ${programId}`)
}

//  Post-verification composite multiplier (I domain) 

/**
 * Applies I-02 / I-03 / I-04 multiplier after field verification.
 * match_score = verifier's yes_count / total_fields  100
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

  const report = app.verification_assignment?.field_reports
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
