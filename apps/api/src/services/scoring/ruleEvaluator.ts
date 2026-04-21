/**
 * DB-Driven Rule Evaluator
 * 
 * Evaluates a single eligibility rule against a StudentData object.
 * All thresholds come from rule.default_value JSONB.
 * Program-level overrides are applied before this function is called.
 *
 * Supported operator types and their default_value shapes:
 *
 *  SCALE   + { type: 'proportional', max_pts, divisor }        A-01, A-02
 *  FORMULA + { type: 'penalty_per_unit', pts_per_unit, min_total }  A-03
 *  EQ      + { value: string|boolean|number }                  simple equality
 *  IN      + { values: string[] }                              membership check
 *  SCALE   + { type: 'step_scale', steps: Step[] }            banded scoring
 *  SCALE   + { type: 'map_scale', map: Record<string,number> }  E-01, E-03
 *  FORMULA + { type: 'per_capita_scale', steps }               B-02
 *  FORMULA + { type: 'ratio_scale', steps }                    B-04
 *  FORMULA + { type: 'composite_sub_rules', sub_rules, max_pts }  C-01, E-02, F-01, F-05
 *  AND_COMPOUND + { field1_*, field2_* }                       C-02, G-01..G-07
 *  FORMULA + { type: 'dual_status', both_deceased, one_deceased }  C-03
 *  FORMULA + { type: 'conditional_scale', condition, steps }   C-06
 *  ML_MODEL + { threshold }                                    G-08 (from Phase 1 result)
 *  CONFIG  (skipped  not scored)
 *  COMPOSITE (skipped  post-pass formula)
 *  THRESHOLD (skipped  post-verification multiplier)
 *  AWARD (skipped  post-selection)
 */

import type { StudentData } from '../../types/student'

//  Field accessor 

/**
 * Maps `condition_field` dotted paths (as stored in DB)  StudentData keys.
 * Covers all fields referenced by the 63 rules.
 */
const FIELD_MAP: Record<string, keyof StudentData> = {
  // Academic
  'student_academic.hsc_percentage':              'hsc_percentage',
  'student_academic.ug_aggregate_pct':            'ug_aggregate_pct',
  'student_academic.active_arrears':              'active_arrears',
  'student_academic.study_mode':                  'study_mode',
  'student_academic.course_type':                 'course_type',
  'student_academic.receiving_other_scholarship': 'receiving_other_scholarship',
  'student_academic.prev_awarded_by_trust':       'prev_awarded_by_trust',
  // Personal
  'student_personal.is_first_graduate':           'is_first_graduate',
  'student_personal.enrollment_status':           'enrollment_status',
  'student_personal.caste_category':              'caste_category',
  'student_personal.religion_minority_status':    'religion_minority_status',
  'student_personal.is_differently_abled':        'is_differently_abled',
  'student_personal.father_status':               'father_status',
  'student_personal.mother_status':               'mother_status',
  'student_personal.is_single_parent':            'is_single_parent',
  'student_personal.is_orphan':                   'is_orphan',
  'student_personal.guardian_annual_income':      'guardian_annual_income',
  'student_personal.residential_type':            'residential_type',
  // Institution
  'institution.is_recognized':                    'institution_recognized',
  // Financial
  'student_financial.total_annual_income':        'total_annual_income',
  'student_financial.ration_card_type':           'ration_card_type',
  'student_financial.loan_outstanding':           'loan_outstanding',
  'student_financial.gold_value_inr':             'gold_value_inr',
  'student_financial.fixed_deposit_amount':       'fixed_deposit_amount',
  // Family
  'student_family.family_size':                   'family_size',
  'student_family.earning_members':               'earning_members',
  'student_family.dependents':                    'dependents',
  'student_family.siblings_in_education':         'siblings_in_education',
  'student_family.has_chronic_illness':           'has_chronic_illness',
  'student_family.mother_widow_pension':          'mother_widow_pension',
  // Assets
  'student_assets.total_asset_value':             'total_asset_value',
  'student_assets.land_area_acres':               'land_area_acres',
  'student_assets.owns_land':                     'owns_land',
  'student_assets.vehicle_count':                 'vehicle_count',
  'student_assets.car_value':                     'car_value',
  'student_assets.electronics_value':             'electronics_value',
  // Housing
  'student_housing.house_type':                   'house_type',
  'student_housing.ownership_type':               'ownership_type',
  'student_housing.total_rooms':                  'total_rooms',
  'student_housing.has_electricity':              'has_electricity',
  'student_housing.has_piped_water':              'has_piped_water',
  'student_housing.has_toilet':                   'has_toilet',
  'student_housing.has_lpg':                      'has_lpg',
  'student_housing.residential_type':             'residential_type',
  // Benefits
  'student_govt_benefits.has_active_benefits':    'has_active_benefits',
  'student_govt_benefits.has_bpl_card':           'has_bpl_card',
  'student_govt_benefits.has_aay_card':           'has_aay_card',
  'student_govt_benefits.has_mgnrega':            'has_mgnrega',
  'student_govt_benefits.has_ayushman':           'has_ayushman',
  'student_govt_benefits.has_pm_schemes':         'has_pm_schemes',
}

function getField(student: StudentData, dotPath: string): unknown {
  // Try full dotted-path lookup first (e.g. 'student_financial.total_annual_income')
  const mappedKey = FIELD_MAP[dotPath]
  if (mappedKey) return student[mappedKey]

  // Fall back: treat dotPath as a direct StudentData key (used by sub-rules)
  // e.g. 'family_size', 'has_electricity', 'is_orphan'
  if (dotPath in student) return (student as unknown as Record<string, unknown>)[dotPath]

  if (dotPath) console.warn(`[RuleEvaluator] Unknown field path: ${dotPath}`)
  return undefined
}

//  Step evaluation helpers 

interface Step {
  lte?: number; lt?: number; gte?: number; gt?: number
  eq?: number | string | boolean
  pts: number
}

/**
 * Evaluates a steps array and returns pts for the first matching step.
 * Steps are evaluated in order  first match wins.
 */
function evalSteps(value: number, steps: Step[], defaultPts = 0): number {
  for (const step of steps) {
    let match = true
    if (step.eq !== undefined && value !== step.eq) match = false
    if (step.lte !== undefined && value > step.lte)  match = false
    if (step.lt  !== undefined && value >= step.lt)  match = false
    if (step.gte !== undefined && value < step.gte)  match = false
    if (step.gt  !== undefined && value <= step.gt)  match = false
    if (match) return step.pts
  }
  return defaultPts
}

//  Sub-rule evaluation (for composite types) 

interface SubRule {
  field: string
  eq?: string | boolean | number
  in?: string[]           // e.g. ['SC', 'ST']
  gte?: number; lte?: number; gt?: number; lt?: number
  pts: number
  // Legacy flag kept for backwards compat
  caste_sc_st?: boolean
}

function evalSubRule(student: StudentData, sub: SubRule): number {
  // Legacy: caste_sc_st
  if (sub.caste_sc_st) {
    return ['SC', 'ST'].includes(student.caste_category) ? sub.pts : 0
  }

  const val = getField(student, sub.field)
  if (val === undefined) return 0

  // IN check (e.g. caste_category IN ['SC','ST'])
  if (sub.in !== undefined) {
    return sub.in.includes(val as string) ? sub.pts : 0
  }

  if (sub.eq !== undefined) {
    return val === sub.eq ? sub.pts : 0
  }

  const numVal = Number(val)
  if (sub.gte !== undefined && numVal < sub.gte)  return 0
  if (sub.lte !== undefined && numVal > sub.lte)  return 0
  if (sub.gt  !== undefined && numVal <= sub.gt)  return 0
  if (sub.lt  !== undefined && numVal >= sub.lt)  return 0
  return sub.pts
}

//  DB Rule shape (what comes from Prisma) 

export interface DbRule {
  rule_code: string
  rule_name: string
  domain: string
  rule_type: string
  operator: string
  condition_field: string
  condition_field_2?: string | null
  default_value: unknown      // JSONB from DB (already JSON-parsed by Prisma)
  score_pts: number           // authoritative point value (negative for DEDUCTION)
  score_bucket: string
  is_active: boolean
}

//  Main evaluator 

/**
 * Evaluates a single DB rule against a student's data.
 * Returns the points awarded (0 if condition doesn't pass).
 * For DEDUCTION rules: returns the deduction (negative) if condition fires, else 0.
 *
 * Skips: COMPOSITE, THRESHOLD, AWARD, CONFIG  those are handled outside the loop.
 */
export function evaluateRule(rule: DbRule, student: StudentData): number {
  if (!rule.is_active) return 0

  const skipped = ['COMPOSITE', 'THRESHOLD', 'AWARD', 'CONFIG']
  if (skipped.includes(rule.rule_type)) return 0

  const dv = rule.default_value as Record<string, unknown>
  const pts = Number(rule.score_pts)

  //  EQ / NEQ operators 
  if (rule.operator === 'EQ' || rule.operator === '==') {
    const fieldVal = getField(student, rule.condition_field)
    const expected = dv.value
    return fieldVal === expected ? pts : 0
  }

  if (rule.operator === 'NEQ' || rule.operator === '!=') {
    const fieldVal = getField(student, rule.condition_field)
    const expected = dv.value
    return fieldVal !== expected ? pts : 0
  }

  //  IN operator 
  if (rule.operator === 'IN') {
    const fieldVal = getField(student, rule.condition_field)
    const values = (dv.values ?? dv.value) as unknown[]
    return Array.isArray(values) && values.includes(fieldVal) ? pts : 0
  }

  //  Simple numeric comparison operators (Prisma enum names + symbols) 
  // Prisma stores: GT, LT, GTE, LTE  symbols: >, <, >=, <=
  const numericOps: Record<string, (a: number, b: number) => boolean> = {
    '>': (a, b) => a > b,  'GT':  (a, b) => a > b,
    '<': (a, b) => a < b,  'LT':  (a, b) => a < b,
    '>=': (a, b) => a >= b, 'GTE': (a, b) => a >= b,
    '<=': (a, b) => a <= b, 'LTE': (a, b) => a <= b,
  }
  if (rule.operator in numericOps) {
    const fieldVal  = Number(getField(student, rule.condition_field))
    const threshold = Number(dv.threshold ?? dv.value)
    return numericOps[rule.operator]!(fieldVal, threshold) ? pts : 0
  }

  //  SCALE operator 
  if (rule.operator === 'SCALE') {
    const type = dv.type as string

    // A-01, A-02: proportional  fieldValue / divisor * max_pts
    if (type === 'proportional') {
      const fieldVal = Number(getField(student, rule.condition_field))
      const maxPts   = Number(dv.max_pts)
      const divisor  = Number(dv.divisor ?? 100)
      if (fieldVal <= 0) return 0
      return Math.min((fieldVal / divisor) * maxPts, maxPts)
    }

    // B-01, D-01, D-02, etc: step_scale
    if (type === 'step_scale') {
      const fieldVal = Number(getField(student, rule.condition_field))
      const steps = dv.steps as Step[]
      return evalSteps(fieldVal, steps, Number(dv.default_pts ?? 0))
    }

    // E-01, E-03: map_scale / enum_scale  string key  points
    if (type === 'map_scale' || type === 'enum_scale') {
      const fieldVal = String(getField(student, rule.condition_field))
      // Seed stores the map under either 'map' or 'values' key
      const map = (dv.map ?? dv.values) as Record<string, number>
      return map[fieldVal] ?? Number(dv.default_pts ?? 0)
    }

    // C-06: conditional_scale (runs only if orphan)
    if (type === 'conditional_scale') {
      if (!student.is_orphan) return 0
      const fieldVal = Number(getField(student, rule.condition_field))
      const steps = dv.steps as Step[]
      return evalSteps(fieldVal, steps, 0)
    }
  }

  //  FORMULA operator 
  if (rule.operator === 'FORMULA') {
    const type = dv.type as string

    // A-03: penalty per unit (arrears)
    if (type === 'penalty_per_unit') {
      const fieldVal     = Number(getField(student, rule.condition_field))
      const ptsPerUnit   = Number(dv.pts_per_unit)
      const minTotal     = Number(dv.min_total)
      return Math.max(fieldVal * ptsPerUnit, minTotal)
    }

    // B-02: per_capita_scale
    if (type === 'per_capita_scale') {
      const income     = Number(getField(student, rule.condition_field))
      const famSize    = Number(getField(student, rule.condition_field_2 ?? 'student_family.family_size'))
      if (famSize <= 0) return 0
      const perCapita  = income / famSize
      const steps      = dv.steps as Step[]
      return evalSteps(perCapita, steps, Number(dv.default_pts ?? 0))
    }

    // B-04: ratio_scale  loan / income ratio
    if (type === 'ratio_scale') {
      const numerator   = Number(getField(student, rule.condition_field))
      const denominator = Number(getField(student, rule.condition_field_2 ?? 'student_financial.total_annual_income'))
      if (denominator <= 0) return 0
      const ratio = numerator / denominator
      const steps = dv.steps as Step[]
      return evalSteps(ratio, steps, Number(dv.default_pts ?? 0))
    }

    // C-01, E-02, F-01, F-05: additive sub-rules with cap
    // Handles: composite_sub_rules, multi_boolean, composite_aggregator, vulnerability_composite
    const ADDITIVE_TYPES = new Set([
      'composite_sub_rules', 'multi_boolean',
      'composite_aggregator', 'vulnerability_composite',
    ])
    if (ADDITIVE_TYPES.has(type)) {
      // Sub-rules stored under 'sub_rules' or 'items' key
      const subRules = (dv.sub_rules ?? dv.items) as SubRule[]
      const maxPts   = Number(dv.max_pts)
      let total = 0
      for (const sub of subRules) {
        total += evalSubRule(student, sub)
      }
      return Math.min(total, maxPts)
    }

    // C-03: dual_status  orphan scoring
    if (type === 'dual_status') {
      const fatherDead = student.father_status === 'deceased'
      const motherDead = student.mother_status === 'deceased'
      if (fatherDead && motherDead) return Number(dv.both_deceased)
      if (fatherDead || motherDead) return Number(dv.one_deceased)
      return Number(dv.both_alive ?? 0)
    }

    // E-04: simple_ratio_threshold / ratio_lt  rooms/family_size < threshold
    if (type === 'simple_ratio_threshold' || type === 'ratio_lt') {
      const numerator   = Number(getField(student, rule.condition_field))
      const denominator = Number(getField(student, rule.condition_field_2 ?? 'student_family.family_size'))
      if (denominator <= 0) return 0
      const ratio     = numerator / denominator
      const threshold = Number(dv.lt_threshold ?? dv.threshold)
      return ratio < threshold ? Number(dv.pts) : 0
    }

    // Fallback for unknown formula types
    console.warn(`[RuleEvaluator] Unknown FORMULA type: ${type} for rule ${rule.rule_code}`)
    return 0
  }

  //  AND_COMPOUND operator 
  if (rule.operator === 'AND_COMPOUND') {
    const val1 = getField(student, rule.condition_field)
    const val2 = getField(student, rule.condition_field_2 ?? '')

    // Evaluate field1 condition
    let f1Pass = true
    if (dv.field1_lte !== undefined && Number(val1) > Number(dv.field1_lte)) f1Pass = false
    if (dv.field1_lt  !== undefined && Number(val1) >= Number(dv.field1_lt)) f1Pass = false
    if (dv.field1_gte !== undefined && Number(val1) < Number(dv.field1_gte)) f1Pass = false
    if (dv.field1_gt  !== undefined && Number(val1) <= Number(dv.field1_gt)) f1Pass = false
    if (dv.field1_eq  !== undefined && val1 !== dv.field1_eq)                f1Pass = false

    // Evaluate field2 condition
    let f2Pass = true
    if (dv.field2_lte !== undefined && Number(val2) > Number(dv.field2_lte))   f2Pass = false
    if (dv.field2_lt  !== undefined && Number(val2) >= Number(dv.field2_lt))   f2Pass = false
    if (dv.field2_gte !== undefined && Number(val2) < Number(dv.field2_gte))   f2Pass = false
    if (dv.field2_gt  !== undefined && Number(val2) <= Number(dv.field2_gt))   f2Pass = false
    if (dv.field2_eq  !== undefined && val2 !== dv.field2_eq)                  f2Pass = false
    if (dv.field2_equals !== undefined && val2 !== dv.field2_equals)           f2Pass = false

    return (f1Pass && f2Pass) ? pts : 0
  }

  //  ML_MODEL operator (G-08) 
  // G-08 is never re-evaluated in Phase 3  it's applied from the Phase 1
  // anomaly_reasons result stored in the application record.
  // Return 0 here; the engine handles G-08 separately.
  if (rule.operator === 'ML_MODEL') {
    return 0
  }

  console.warn(`[RuleEvaluator] Unhandled operator: ${rule.operator} for rule ${rule.rule_code}`)
  return 0
}

//  G-rule condition check (Phase 1, returns boolean) 

/**
 * Re-uses the AND_COMPOUND evaluation logic but returns boolean (fired/not fired).
 * Used by anomalyPreFilter to check G-01..G-07 from DB-loaded rules.
 */
export function checkDeductionFired(rule: DbRule, student: StudentData): boolean {
  if (!rule.is_active) return false
  // evaluateRule returns score_pts (negative) if fired, 0 if not
  return evaluateRule(rule, student) !== 0
}
