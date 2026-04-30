/**
 * ML Service Client  Isolation Forest anomaly detection only.
 * XGBoost need-score blend (H-03) has been removed.
 * This client is used exclusively by Phase 1 (anomalyPreFilter).
 */
import type { StudentData } from '../../types/student'

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000'

// Build the 40-feature vector sent to the Isolation Forest
function buildFeatureVector(s: StudentData): Record<string, number> {
  const houseTypeMap: Record<string, number> =
    { kuccha: 1, semi_pucca: 2, pucca_rented: 3, pucca_owned: 4, flat_apartment: 5, homeless: 0 }
  const ownershipMap: Record<string, number> =
    { homeless: 0, rented: 1, govt_allotted: 2, owned: 3 }
  const casteMap: Record<string, number> =
    { SC: 1, ST: 2, OBC: 3, General: 4, NT: 5 }
  const rationMap: Record<string, number> =
    { AAY: 1, BPL: 2, OPH: 3, none: 4 }
  const residentialMap: Record<string, number> =
    { tribal: 1, rural: 2, urban: 3 }
  const enrollmentMap: Record<string, number> =
    { inactive: 0, on_leave: 1, active: 2 }

  return {
    total_annual_income:      s.total_annual_income,
    income_per_capita:        s.family_size > 0 ? s.total_annual_income / s.family_size : 0,
    family_size:              s.family_size,
    earning_members:          s.earning_members,
    dependents:               s.dependents,
    car_value:                s.car_value,
    gold_value_inr:           s.gold_value_inr,
    fixed_deposit_amount:     s.fixed_deposit_amount,
    electronics_value:        s.electronics_value,
    total_asset_value:        s.total_asset_value,
    land_area_acres:          s.land_area_acres,
    vehicle_count:            s.vehicle_count,
    house_type_encoded:       houseTypeMap[s.house_type] ?? 4,
    has_electricity:          s.has_electricity ? 1 : 0,
    has_piped_water:          s.has_piped_water ? 1 : 0,
    has_toilet:               s.has_toilet ? 1 : 0,
    has_lpg:                  s.has_lpg ? 1 : 0,
    caste_encoded:            casteMap[s.caste_category] ?? 4,
    is_differently_abled:     s.is_differently_abled ? 1 : 0,
    has_bpl_card:             s.has_bpl_card ? 1 : 0,
    has_aay_card:             s.has_aay_card ? 1 : 0,
    has_mgnrega:              s.has_mgnrega ? 1 : 0,
    has_ayushman:             s.has_ayushman ? 1 : 0,
    has_pm_schemes:           s.has_pm_schemes ? 1 : 0,
    loan_outstanding:         s.loan_outstanding,
    hsc_percentage:           s.hsc_percentage,
    ug_aggregate_pct:         s.ug_aggregate_pct,
    active_arrears:           s.active_arrears,
    is_first_graduate:        s.is_first_graduate ? 1 : 0,
    study_mode_encoded:       s.study_mode === 'full_time' ? 1 : 0,
    owns_land:                s.owns_land ? 1 : 0,
    father_status_encoded:    s.father_status === 'deceased' ? 1 : 0,
    mother_status_encoded:    s.mother_status === 'deceased' ? 1 : 0,
    has_chronic_illness:      s.has_chronic_illness ? 1 : 0,
    mother_widow_pension:     s.mother_widow_pension ? 1 : 0,
    religion_minority:        s.religion_minority_status ? 1 : 0,
    enrollment_encoded:       enrollmentMap[s.enrollment_status] ?? 2,
    residential_encoded:      residentialMap[s.residential_type] ?? 3,
    ration_type_encoded:      rationMap[s.ration_card_type] ?? 4,
    loan_to_income_ratio:     s.total_annual_income > 0
                                ? s.loan_outstanding / s.total_annual_income : 0,
    ownership_encoded:        ownershipMap[s.ownership_type] ?? 3,
  }
}

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${ML_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`ML service error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

export const mlClient = {
  /** Calls Isolation Forest /anomaly endpoint (Phase 1 only). */
  async detectAnomaly(student: StudentData): Promise<{ anomaly_score: number }> {
    const features = buildFeatureVector(student)
    return post<{ anomaly_score: number }>('/anomaly', { features })
  },
}
