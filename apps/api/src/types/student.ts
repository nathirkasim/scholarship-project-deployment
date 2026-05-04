/**
 * Flat StudentData assembled from all 7 student profile tables.
 * Used by both anomaly pre-filter (Phase 1) and rule engine (Phase 3).
 */
export interface StudentData {
  application_id: string
  program_id: string
  user_id: string

  //  Personal 
  caste_category: string           // SC | ST | OBC | General
  religion_minority_status: boolean
  is_differently_abled: boolean
  is_first_graduate: boolean
  father_status: string            // alive | deceased
  mother_status: string            // alive | deceased
  is_single_parent: boolean
  is_orphan: boolean               // derived: both parents deceased
  guardian_annual_income: number   // only relevant if orphan
  residential_type: string         // urban | rural | tribal
  enrollment_status: string        // active | inactive

  //  Academic 
  hsc_percentage: number           // 0100
  ug_aggregate_pct: number         // 0100 (0 if not yet applicable)
  active_arrears: number           // count of uncleared papers
  study_mode: string               // full_time | part_time | distance
  course_type: string              // engineering | medicine | law | arts_science | management | diploma | other
  receiving_other_scholarship: boolean
  prev_awarded_by_trust: boolean

  //  Family 
  family_size: number
  earning_members: number
  dependents: number
  siblings_in_education: number
  has_chronic_illness: boolean
  mother_widow_pension: boolean

  //  Financial 
  total_annual_income: number      // /year
  ration_card_type: string         // none | APL | BPL | AAY
  loan_outstanding: number         // 
  gold_value_inr: number           // 
  fixed_deposit_amount: number     // 

  //  Assets 
  total_asset_value: number        //  total declared
  land_area_acres: number          // 0 if no land
  owns_land: boolean
  vehicle_count: number
  car_value: number                //  (two-wheelers < 50K excluded)
  electronics_value: number        // 

  //  Housing 
  house_type: string               // kuccha | semi_pucca | pucca_rented | pucca_owned | flat_apartment
  ownership_type: string           // owned | rented | govt_allotted | homeless
  total_rooms: number
  has_electricity: boolean
  has_piped_water: boolean
  has_toilet: boolean
  has_lpg: boolean
  cooking_fuel: string             // lpg | wood | coal | other

  //  Benefits 
  has_active_benefits: boolean
  has_bpl_card: boolean
  has_aay_card: boolean
  has_mgnrega: boolean
  has_ayushman: boolean
  has_pm_schemes: boolean
}

//  Score outputs 

export interface ScoreResult {
  merit_score: number
  rule_need_score: number      // need_score is now 100% rule-based (XGBoost blend removed)
  integrity_adj: number
  composite_score: number
  score_breakdown: ScoreBreakdown
}

export interface ScoreBreakdown {
  domain_a: Record<string, number>
  domain_b: Record<string, number>
  domain_c: Record<string, number>
  domain_d: Record<string, number>
  domain_e: Record<string, number>
  domain_f: Record<string, number>
  domain_g: Record<string, number>
}

//  Rule evaluation types 

export interface EvaluatedRule {
  rule_code: string
  domain: string
  rule_type: string
  score_bucket: string
  pts: number           // actual points awarded (0 for deductions that didn't fire)
  fired: boolean        // whether the condition triggered
}
