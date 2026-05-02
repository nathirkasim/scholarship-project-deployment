/**
 * seedRejectedApplications.ts
 * Adds 5 students whose profiles trigger different G-rules → anomaly_flagged
 * Does NOT wipe existing data — appends only.
 *
 * Rule triggers:
 *   R-1 Keerthi Varman  — G-01: income ≤₹2L + car ≥₹3L  (Vehicle fraud)
 *   R-2 Santhosh Kumar  — G-03: income ≤₹2L + gold ≥₹2L  (Gold fraud)
 *   R-3 Meenakshi Pillai— G-04: income ≤₹2L + FD ≥₹1L    (Bank fraud)
 *   R-4 Balamurugan Das — G-05: kuccha house + assets ≥₹1L (Housing-asset mismatch)
 *   R-5 Chandran Iyer   — G-07: benefits active + income ≥₹5L (Benefits + high income)
 */

import * as path   from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import * as bcrypt   from 'bcryptjs'
import { PrismaClient, Prisma } from '@prisma/client'
import { runAnomalyPreFilter }  from '../services/anomaly/anomalyPreFilter'

const prisma = new PrismaClient()
type InstCode = 'ANNA_UNIV' | 'IIT_MADRAS' | 'PSG_TECH' | 'GOVT_ARTS_CBE' | 'NIT_TRICHY'

interface StudentProfile {
  user:     { email: string; full_name: string; phone: string }
  rejectRule: string
  personal: {
    date_of_birth: Date; gender: string
    caste_category: 'SC'|'ST'|'OBC'|'General'|'NT'
    religion_minority_status: boolean
    is_differently_abled: boolean; is_first_graduate: boolean
    father_status: string; mother_status: string
    is_single_parent: boolean; is_orphan: boolean
    guardian_name?: string; guardian_annual_income?: number
    residential_type: string; state: string; district: string; pincode: string
    enrollment_status: 'active'|'inactive'
  }
  academic: {
    hsc_percentage: number; hsc_board: string; hsc_year: number
    ug_aggregate_pct: number|null; current_year_of_study: number
    course_type: string; course_name: string; study_mode: 'full_time'|'part_time'|'distance'
    active_arrears: number; institution_code: InstCode
    receiving_other_scholarship: boolean; prev_awarded_by_trust: boolean
  }
  family: {
    family_size: number; earning_members: number; dependents: number
    siblings_in_education: number; has_chronic_illness: boolean; mother_widow_pension: boolean
  }
  financial: {
    total_annual_income: number
    ration_card_type: 'BPL'|'AAY'|'OPH'|'none'
    loan_outstanding: number; gold_value_inr: number; fixed_deposit_amount: number
  }
  assets: {
    total_asset_value: number; land_area_acres: number; owns_land: boolean
    vehicle_count: number; car_value: number; electronics_value: number
  }
  housing: {
    house_type: 'kuccha'|'semi_pucca'|'pucca_rented'|'pucca_owned'|'flat_apartment'
    ownership_type: 'owned'|'rented'|'govt_allotted'|'homeless'
    total_rooms: number; has_electricity: boolean; has_piped_water: boolean
    has_toilet: boolean; has_lpg: boolean
  }
  benefits: {
    has_active_benefits: boolean; has_bpl_card: boolean; has_aay_card: boolean
    has_mgnrega: boolean; has_ayushman: boolean; has_pm_schemes: boolean
  }
}

const REJECTED_STUDENTS: StudentProfile[] = [

  // R-1 — Keerthi Varman: G-01 trigger: income ₹1.8L + car value ₹3.5L
  {
    user: { email: 'keerthi.varman@demo.rej', full_name: 'Keerthi Varman', phone: '9200000001' },
    rejectRule: 'G-01 (Low Income + Vehicle)',
    personal: {
      date_of_birth: new Date('2003-04-10'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Madurai', pincode: '625002',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 76.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 70.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.E. Mechanical Engineering',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 180000, ration_card_type: 'BPL', loan_outstanding: 20000, gold_value_inr: 15000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 420000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 350000, electronics_value: 10000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // R-2 — Santhosh Kumar: G-03 trigger: income ₹1.5L + gold ₹2.5L
  {
    user: { email: 'santhosh.kumar@demo.rej', full_name: 'Santhosh Kumar', phone: '9200000002' },
    rejectRule: 'G-03 (Low Income + Gold)',
    personal: {
      date_of_birth: new Date('2002-11-22'), gender: 'Male',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Salem', pincode: '636007',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 71.5, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 66.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.A. Tamil Literature',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 150000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 250000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 290000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 8000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 2, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // R-3 — Meenakshi Pillai: G-04 trigger: income ₹1.2L + fixed deposits ₹1.8L
  {
    user: { email: 'meenakshi.pillai@demo.rej', full_name: 'Meenakshi Pillai', phone: '9200000003' },
    rejectRule: 'G-04 (Low Income + Fixed Deposits)',
    personal: {
      date_of_birth: new Date('2003-07-05'), gender: 'Female',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Thanjavur', pincode: '613009',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 69.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.Sc. Physics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 120000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 10000, fixed_deposit_amount: 180000 },
    assets: { total_asset_value: 210000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 12000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: true, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // R-4 — Balamurugan Das: G-05 trigger: kuccha house + total_asset_value ₹1.4L
  {
    user: { email: 'balamurugan.das@demo.rej', full_name: 'Balamurugan Das', phone: '9200000004' },
    rejectRule: 'G-05 (Kuccha House + High Assets)',
    personal: {
      date_of_birth: new Date('2004-02-17'), gender: 'Male',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Vellore', pincode: '632009',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 72.5, hsc_board: 'TN Board', hsc_year: 2023,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.Sc. Agriculture',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 200000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 20000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 140000, land_area_acres: 0.5, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 60000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 1, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // R-5 — Chandran Iyer: G-07 trigger: active benefits + income ₹5.5L
  {
    user: { email: 'chandran.iyer@demo.rej', full_name: 'Chandran Iyer', phone: '9200000005' },
    rejectRule: 'G-07 (Govt Benefits + High Income)',
    personal: {
      date_of_birth: new Date('2001-09-30'), gender: 'Male',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600030',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 78.0, hsc_board: 'CBSE', hsc_year: 2020,
      ug_aggregate_pct: 72.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.E. Computer Science',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'PSG_TECH',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 550000, ration_card_type: 'none', loan_outstanding: 100000, gold_value_inr: 90000, fixed_deposit_amount: 60000 },
    assets: { total_asset_value: 450000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 180000, electronics_value: 55000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },
]

const hr = (c = '─', w = 72) => c.repeat(w)

async function main() {
  console.log('\n' + hr())
  console.log('  REJECTED APPLICATIONS SEEDER  |  5 profiles → anomaly_flagged')
  console.log(hr())

  const program = await prisma.scholarshipProgram.findFirst({ where: { is_active: true }, orderBy: { created_at: 'desc' } })
  if (!program) { console.error('\n  No active program.\n'); process.exit(1) }

  const institutions = await prisma.institution.findMany()
  const instMap      = new Map(institutions.map(i => [i.code, i.id]))
  const passwordHash = await bcrypt.hash('Demo@1234', 12)

  console.log(`  Program  : ${program.program_name}`)
  console.log(`  Adding   : ${REJECTED_STUDENTS.length} fraud-profile applicants\n`)

  const applicationIds: Array<{ id: string; name: string; rule: string }> = []

  for (const s of REJECTED_STUDENTS) {
    const user = await prisma.user.upsert({
      where:  { email: s.user.email },
      update: { password_hash: passwordHash, full_name: s.user.full_name, phone: s.user.phone },
      create: { email: s.user.email, password_hash: passwordHash, full_name: s.user.full_name, phone: s.user.phone, role: 'student', is_active: true },
    })

    await prisma.studentPersonal.upsert({
      where:  { user_id: user.id },
      update: { ...s.personal, guardian_name: s.personal.guardian_name ?? null, guardian_annual_income: s.personal.guardian_annual_income ?? null },
      create: { user_id: user.id, ...s.personal, guardian_name: s.personal.guardian_name ?? null, guardian_annual_income: s.personal.guardian_annual_income ?? null },
    })

    const institutionId = instMap.get(s.academic.institution_code)
    if (!institutionId) { console.error(`  Institution not found: ${s.academic.institution_code}`); continue }
    const { institution_code, ...acad } = s.academic
    await prisma.studentAcademic.upsert({
      where:  { user_id: user.id },
      update: { ...acad, institution_id: institutionId, ug_aggregate_pct: acad.ug_aggregate_pct ?? null },
      create: { user_id: user.id, ...acad, institution_id: institutionId, ug_aggregate_pct: acad.ug_aggregate_pct ?? null },
    })

    await prisma.studentFamily.upsert({ where: { user_id: user.id }, update: s.family, create: { user_id: user.id, ...s.family } })
    await prisma.studentFinancial.upsert({ where: { user_id: user.id }, update: s.financial, create: { user_id: user.id, ...s.financial } })
    await prisma.studentAssets.upsert({ where: { user_id: user.id }, update: s.assets, create: { user_id: user.id, ...s.assets } })
    await prisma.studentHousing.upsert({ where: { user_id: user.id }, update: s.housing, create: { user_id: user.id, ...s.housing } })
    await prisma.studentGovtBenefits.upsert({ where: { user_id: user.id }, update: s.benefits, create: { user_id: user.id, ...s.benefits } })

    const app = await prisma.application.upsert({
      where:  { program_id_user_id: { program_id: program.id, user_id: user.id } },
      update: { status: 'submitted', anomaly_flag: false, anomaly_score: null, anomaly_reasons: Prisma.DbNull, merit_score: null, rule_need_score: null, integrity_adj: null, composite_score: null, scored_at: null, submitted_at: new Date(), rejection_reason: null },
      create: { program_id: program.id, user_id: user.id, status: 'submitted', submitted_at: new Date() },
    })
    applicationIds.push({ id: app.id, name: s.user.full_name, rule: s.rejectRule })
    process.stdout.write('.')
  }
  console.log(`\n   Created ${applicationIds.length} applications`)

  console.log('\n  Running Phase 1 anomaly check...')
  const results: Array<{ name: string; rule: string; status: string; flags: string[] }> = []

  for (const { id, name, rule } of applicationIds) {
    try { await runAnomalyPreFilter(id) } catch { /* ML offline — G-rules still run */ }
    const a = await prisma.application.findUniqueOrThrow({ where: { id } })
    const reasons = a.anomaly_reasons as any
    const flags: string[] = [
      ...(reasons?.g_rules_fired ?? []),
      ...(reasons?.ml_flag ? ['G-08'] : []),
    ]
    results.push({ name, rule, status: a.status, flags })
  }

  console.log('\n' + hr())
  console.log('  RESULTS')
  console.log(hr())
  console.log('  Name                    Expected Rule               Status           G-Flags Fired')
  console.log('  ' + hr('-', 70))

  for (const r of results) {
    const name   = r.name.padEnd(22)
    const rule   = r.rule.padEnd(28)
    const status = r.status.padEnd(16)
    const flags  = r.flags.join(', ') || 'none'
    const tick   = r.status === 'anomaly_flagged' ? '✓' : '✗'
    console.log(`  ${tick}  ${name} ${rule} ${status} [${flags}]`)
  }

  const flagged = results.filter(r => r.status === 'anomaly_flagged').length
  const missed  = results.filter(r => r.status !== 'anomaly_flagged').length

  console.log(`\n  anomaly_flagged : ${flagged} / ${results.length}`)
  if (missed > 0) console.log(`  NOT flagged     : ${missed}  ← check G-rule thresholds`)
  console.log('\n  Password: Demo@1234  |  Admin: admin@scholarship.org / Admin@1234')
  console.log(hr() + '\n')
}

main()
  .catch(e => { console.error('\n  Fatal:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
