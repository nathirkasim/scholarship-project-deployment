/**
 * Shared student data loader.
 * Assembles a flat StudentData object from all 7 student profile tables.
 * Used by both Phase 1 (anomaly pre-filter) and Phase 3 (rule engine).
 */

import { prisma } from '../../lib/prisma'
import type { StudentData } from '../../types/student'

export async function loadStudentData(applicationId: string): Promise<StudentData> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { user_id: true, program_id: true },
  })

  const [personal, academic, family, financial, assets, housing, benefits] = await Promise.all([
    prisma.studentPersonal.findUnique({ where: { user_id: app.user_id } }),
    prisma.studentAcademic.findUnique({
      where: { user_id: app.user_id },
      include: { institution: { select: { is_recognized: true } } },
    }),
    prisma.studentFamily.findUnique({ where: { user_id: app.user_id } }),
    prisma.studentFinancial.findUnique({ where: { user_id: app.user_id } }),
    prisma.studentAssets.findUnique({ where: { user_id: app.user_id } }),
    prisma.studentHousing.findUnique({ where: { user_id: app.user_id } }),
    prisma.studentGovtBenefits.findUnique({ where: { user_id: app.user_id } }),
  ])

  // Derived: orphan status (both parents deceased)
  const fatherDead = (personal?.father_status ?? 'alive') === 'deceased'
  const motherDead = (personal?.mother_status ?? 'alive') === 'deceased'
  const is_orphan  = fatherDead && motherDead

  // Derived: cooking_fuel from has_lpg boolean (schema uses has_lpg directly)
  const has_lpg      = housing?.has_lpg ?? true
  const cooking_fuel = has_lpg ? 'lpg' : 'other'

  return {
    application_id: applicationId,
    program_id: app.program_id,
    user_id: app.user_id,

    //  Personal 
    caste_category:           personal?.caste_category          ?? 'General',
    religion_minority_status: personal?.religion_minority_status ?? false,
    is_differently_abled:     personal?.is_differently_abled     ?? false,
    is_first_graduate:        personal?.is_first_graduate        ?? false,
    father_status:            personal?.father_status            ?? 'alive',
    mother_status:            personal?.mother_status            ?? 'alive',
    is_single_parent:         personal?.is_single_parent         ?? false,
    is_orphan,
    guardian_annual_income:   Number(personal?.guardian_annual_income ?? 0),
    residential_type:         personal?.residential_type          ?? 'urban',
    enrollment_status:        personal?.enrollment_status         ?? 'active',

    //  Academic 
    hsc_percentage:              Number(academic?.hsc_percentage     ?? 0),
    ug_aggregate_pct:            Number(academic?.ug_aggregate_pct   ?? 0),
    active_arrears:              academic?.active_arrears             ?? 0,
    study_mode:                  academic?.study_mode                 ?? 'full_time',
    course_type:                 academic?.course_type                ?? '',
    receiving_other_scholarship: academic?.receiving_other_scholarship ?? false,
    prev_awarded_by_trust:       academic?.prev_awarded_by_trust       ?? false,
    institution_recognized:      academic?.institution?.is_recognized  ?? false,

    //  Family 
    family_size:           family?.family_size           ?? 1,
    earning_members:       family?.earning_members        ?? 1,
    dependents:            family?.dependents             ?? 0,
    siblings_in_education: family?.siblings_in_education  ?? 0,
    has_chronic_illness:   family?.has_chronic_illness    ?? false,
    mother_widow_pension:  family?.mother_widow_pension   ?? false,

    //  Financial 
    total_annual_income:  Number(financial?.total_annual_income  ?? 0),
    ration_card_type:     financial?.ration_card_type             ?? 'none',
    loan_outstanding:     Number(financial?.loan_outstanding      ?? 0),
    gold_value_inr:       Number(financial?.gold_value_inr        ?? 0),
    fixed_deposit_amount: Number(financial?.fixed_deposit_amount  ?? 0),

    //  Assets 
    total_asset_value:  Number(assets?.total_asset_value  ?? 0),
    land_area_acres:    Number(assets?.land_area_acres    ?? 0),
    owns_land:          assets?.owns_land                  ?? false,
    vehicle_count:      assets?.vehicle_count              ?? 0,
    car_value:          Number(assets?.car_value           ?? 0),
    electronics_value:  Number(assets?.electronics_value  ?? 0),

    //  Housing 
    house_type:      housing?.house_type      ?? 'pucca_owned',
    ownership_type:  housing?.ownership_type  ?? 'owned',
    total_rooms:     housing?.total_rooms      ?? 2,
    has_electricity: housing?.has_electricity  ?? true,
    has_piped_water: housing?.has_piped_water  ?? true,
    has_toilet:      housing?.has_toilet       ?? true,
    has_lpg,
    cooking_fuel,

    //  Benefits 
    has_active_benefits: benefits?.has_active_benefits ?? false,
    has_bpl_card:        benefits?.has_bpl_card         ?? false,
    has_aay_card:        benefits?.has_aay_card          ?? false,
    has_mgnrega:         benefits?.has_mgnrega           ?? false,
    has_ayushman:        benefits?.has_ayushman           ?? false,
    has_pm_schemes:      benefits?.has_pm_schemes         ?? false,
  }
}
