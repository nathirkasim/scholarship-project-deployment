/**
 * Phase 1  Anomaly Pre-Filter
 * 
 * Runs immediately on every submitted application (via BullMQ anomaly-check queue).
 *
 * Steps:
 *   1. Status  anomaly_checking
 *   2. Load G-01..G-07 DEDUCTION rules from DB (thresholds from default_value JSONB)
 *   3. Apply program_rule_overrides for G rules if any
 *   4. Evaluate each G rule condition (boolean fired/not fired)
 *   5. Call ML service  Isolation Forest score (G-08)
 *   6. ml_flagged = anomaly_score >= threshold (from G-08 rule default_value)
 *   7. anomaly_flag = any rule fired OR ml_flagged
 *   8. Persist: anomaly_score, anomaly_flag, anomaly_reasons, new status
 *   9. If clean  immediately run Phase 2 shortlist check
 *
 * anomaly_reasons shape (matches CLAUDE.md spec):
 *   { "g_rules_fired": ["G-01", "G-03"], "ml_flag": true }
 */

import { prisma }              from '../../lib/prisma'
import { mlClient }            from '../mlClient'
import { loadStudentData }     from '../scoring/studentDataLoader'
import { checkDeductionFired } from '../scoring/ruleEvaluator'
import type { DbRule }         from '../scoring/ruleEvaluator'
import type { StudentData }    from '../../types/student'

//  Rule loader (G domain only, with program overrides) 

async function loadGRules(programId: string): Promise<DbRule[]> {
  const [rules, overrides] = await Promise.all([
    prisma.eligibilityRule.findMany({
      where: { domain: 'G', is_active: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.programRuleOverride.findMany({
      where: { program_id: programId, is_active: true, rule: { domain: 'G' } },
      select: { rule_id: true, override_value: true },
    }),
  ])

  // Build override lookup with explicit types to satisfy strict mode
  const overrideMap: Map<string, unknown> = new Map()
  for (const o of overrides) {
    overrideMap.set(String(o.rule_id), o.override_value as unknown)
  }

  const dbRules: DbRule[] = []
  for (const r of rules) {
    dbRules.push({
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
  return dbRules
}

//  Phase 2 shortlist check 

export async function runShortlistCheck(
  applicationId: string,
  student?: StudentData,
): Promise<void> {
  const s = student ?? await loadStudentData(applicationId)

  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { program: true },
  })

  // Check 1  Active enrollment
  if (s.enrollment_status !== 'active') {
    await failShortlist(applicationId, 'Student is not actively enrolled')
    return
  }

  // Check 2  Recognized institution
  if (!s.institution_recognized) {
    await failShortlist(applicationId, 'Institution is not UGC/AICTE/State Board recognized')
    return
  }

  // Check 3  No duplicate active application for the same program
  const duplicate = await prisma.application.findFirst({
    where: {
      program_id: app.program_id,
      user_id:    app.user_id,
      id:         { not: applicationId },
      status:     { notIn: ['draft', 'rejected', 'not_shortlisted'] },
    },
  })
  if (duplicate) {
    await failShortlist(applicationId, 'An active application for this program already exists')
    return
  }

  // Check 4  Course type eligibility via A-05 rule (approved list stored in eligibility_rules)
  const courseRule = await prisma.eligibilityRule.findFirst({
    where: { rule_code: 'A-05', is_active: true },
    select: { default_value: true },
  })
  const approvedCourses = (courseRule?.default_value as { courses?: string[] })?.courses
  if (approvedCourses && approvedCourses.length > 0 && s.course_type && !approvedCourses.includes(s.course_type)) {
    await failShortlist(applicationId, `Course type "${s.course_type}" is not approved for this program`)
    return
  }

  // Check 5  Shortlist pool capacity (max 2 seats by default)
  const shortlistCount = await prisma.application.count({
    where: {
      program_id: app.program_id,
      status:     { in: ['shortlisted', 'scored', 'verification_pending', 'verification_complete'] },
    },
  })
  const multiplier   = Number((app.program as Record<string, unknown>).shortlist_multiplier ?? 2)
  const maxShortlist = app.program.total_seats * multiplier

  if (shortlistCount >= maxShortlist) {
    // Pool is full  stay as scoring_pending, will be promoted in a later batch run
    return
  }

  //  All checks passed 
  await prisma.application.update({
    where: { id: applicationId },
    data:  { status: 'shortlisted' },
  })

  await prisma.applicationStatusLog.create({
    data: {
      application_id: applicationId,
      from_status:    'scoring_pending',
      to_status:      'shortlisted',
      reason:          'All Phase 2 eligibility checks passed',
    },
  })

  await prisma.notification.create({
    data: {
      user_id:        s.user_id,
      application_id: applicationId,
      type:           'status_update',
      title:          'Application Shortlisted',
      message:        'Your application has passed eligibility checks and is shortlisted for full evaluation.',
    },
  })
}

async function failShortlist(applicationId: string, reason: string): Promise<void> {
  const app = await prisma.application.update({
    where: { id: applicationId },
    data:  { status: 'not_shortlisted', rejection_reason: reason },
    select: { user_id: true },
  })

  await prisma.applicationStatusLog.create({
    data: {
      application_id: applicationId,
      from_status:    'scoring_pending',
      to_status:      'not_shortlisted',
      reason:          reason,
    },
  })

  await prisma.notification.create({
    data: {
      user_id:        app.user_id,
      application_id: applicationId,
      type:           'status_update',
      title:          'Application Not Shortlisted',
      message:        `Your application did not meet eligibility requirements: ${reason}`,
    },
  })
}

//  Phase 1 main function 

export async function runAnomalyPreFilter(applicationId: string): Promise<void> {
  // Step 1: Mark as anomaly_checking
  await prisma.application.update({
    where: { id: applicationId },
    data:  { status: 'anomaly_checking' },
  })

  await prisma.applicationStatusLog.create({
    data: {
      application_id: applicationId,
      from_status:    'submitted',
      to_status:      'anomaly_checking',
      reason:          'Phase 1 anomaly pre-filter started',
    },
  })

  // Load student data
  const app     = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })
  const student = await loadStudentData(applicationId)

  // Step 2: Load G-01..G-07 rules from DB (with program overrides)
  const gRules      = await loadGRules(app.program_id)
  const gDeductions = gRules.filter(r => r.rule_code !== 'G-08')
  const g08Rule     = gRules.find(r => r.rule_code === 'G-08')

  // Step 3: Evaluate G-01..G-07 conditions (boolean check only  no score applied yet)
  const g_rules_fired: string[] = []
  const g_rules_fired_names: string[] = []
  for (const rule of gDeductions) {
    if (checkDeductionFired(rule, student)) {
      g_rules_fired.push(rule.rule_code)
      g_rules_fired_names.push(rule.rule_name)
    }
  }

  // Step 4: G-08  Isolation Forest via ML service
  let anomaly_score = 0.0
  let ml_flag       = false

  // Read G-08 threshold from DB rule (default: 0.65)
  const g08Threshold = Number(
    (g08Rule?.default_value as { threshold?: number })?.threshold ?? 0.65
  )

  try {
    const mlResult = await mlClient.detectAnomaly(student)
    anomaly_score  = mlResult.anomaly_score
    ml_flag        = anomaly_score >= g08Threshold
  } catch (err) {
    // ML service unavailable  log but don't block the pipeline
    console.warn('[AnomalyPreFilter] ML service unavailable, skipping G-08:', err)
    anomaly_score = 0.0
  }

  // Step 5: Determine outcome
  const anomaly_flag = g_rules_fired.length > 0 || ml_flag

  // anomaly_reasons shape per CLAUDE.md: { g_rules_fired: [...], ml_flag: bool }
  const anomaly_reasons = { g_rules_fired, ml_flag }

  const newStatus = anomaly_flag ? 'anomaly_flagged' : 'scoring_pending'

  let rejectionReason: string | null = null
  if (anomaly_flag) {
    const reasons_arr: string[] = []
    if (ml_flag) reasons_arr.push('Isolation Forest Anomaly Detection')
    if (g_rules_fired_names.length > 0) reasons_arr.push(...g_rules_fired_names)
    rejectionReason = 'Anomaly flagged — data contradictions detected: ' + reasons_arr.join('; ')
  }

  // Step 6: Persist
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      anomaly_score,
      anomaly_flag,
      anomaly_reasons,
      anomaly_checked_at: new Date(),
      status:             newStatus,
      rejection_reason:   rejectionReason,
    },
  })

  await prisma.applicationStatusLog.create({
    data: {
      application_id: applicationId,
      from_status:    'anomaly_checking',
      to_status:      newStatus,
      reason:          anomaly_flag
        ? `Flagged  G rules: [${g_rules_fired.join(', ')}] | ML: ${ml_flag} (score=${anomaly_score.toFixed(3)})`
        : `Clean  anomaly_score=${anomaly_score.toFixed(3)}`,
    },
  })

  // Step 7: Notify student
  const programName = await prisma.scholarshipProgram
    .findUnique({ where: { id: app.program_id }, select: { program_name: true } })
    .then((p: { program_name: string } | null) => p?.program_name ?? 'the program')

  if (anomaly_flag) {
    await prisma.notification.create({
      data: {
        user_id:        student.user_id,
        application_id: applicationId,
        type:           'status_update',
        title:          'Application Flagged for Review',
        message:        'Your application has been flagged due to contradictory data and is under administrative review.',
      },
    })
  } else {
    await prisma.notification.create({
      data: {
        user_id:        student.user_id,
        application_id: applicationId,
        type:           'status_update',
        title:          'Application Received',
        message:        `Your application for ${programName} has been received and is being processed.`,
      },
    })

    // Step 8: Immediately trigger Phase 2 for clean applications
    await runShortlistCheck(applicationId, student)
  }
}
