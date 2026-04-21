/**
 * Demo Application Seeder  5 diverse student profiles
 * 
 * Creates 5 users + all 7 profile tables each, then runs
 * the full 3-phase pipeline on each application:
 *   Phase 1  Anomaly Pre-Filter (G-01..G-07 + Isolation Forest)
 *   Phase 2  Shortlist eligibility check (runs inside Phase 1)
 *   Phase 3  Rule Engine Scoring (Domains AF + integrity)
 *
 * Run from apps/api/:
 *   npx tsx src/scripts/seedDemoApplications.ts
 *
 * Prerequisites:
 *   1. Database running (Docker Compose or local Postgres)
 *   2. main seed.ts already run (institutions + rules + program)
 *   3. DATABASE_URL set (loaded from root /.env automatically)
 */

import * as path from 'path'
import * as dotenv from 'dotenv'

// Load .env from project root (two levels up from apps/api/)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import * as bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { runAnomalyPreFilter } from '../services/anomaly/anomalyPreFilter'
import { runScoringEngine }    from '../services/scoring/ruleEngine'

const prisma = new PrismaClient()

//  Student Profile Definitions 

const STUDENTS = [

  // 
  // Student 1: Priya Sharma  Strong approved candidate
  // SC, rural orphan, BPL+MGNREGA, kuccha house, engineering 85% HSC
  // Expected: HIGH composite  high need + good merit, no fraud signals
  // 
  {
    user: {
      email: 'priya.sharma.demo@scholarship.org',
      full_name: 'Priya Sharma',
      phone: '9876543210',
    },
    personal: {
      date_of_birth:            new Date('2003-05-14'),
      gender:                   'Female',
      caste_category:           'SC'    as const,
      religion_minority_status: false,
      is_differently_abled:     false,
      is_first_graduate:        true,
      father_status:            'deceased',
      mother_status:            'deceased',
      is_single_parent:         false,
      is_orphan:                true,
      guardian_name:            'Kamala Devi (Aunt)' as string | undefined,
      guardian_annual_income:   60000 as number | undefined,
      residential_type:         'rural',
      state:                    'Tamil Nadu',
      district:                 'Villupuram',
      pincode:                  '605602',
      enrollment_status:        'active' as const,
    },
    academic: {
      hsc_percentage:              85.4,
      hsc_board:                   'Tamil Nadu State Board',
      hsc_year:                    2022,
      ug_aggregate_pct:            79.2 as number | null,
      current_year_of_study:       3,
      course_type:                 'UG',
      course_name:                 'B.E. Computer Science',
      study_mode:                  'full_time' as const,
      active_arrears:              0,
      institution_code:            'ANNA_UNIV',
      receiving_other_scholarship: false,
      prev_awarded_by_trust:       false,
    },
    family: {
      family_size:          4,
      earning_members:      1,
      dependents:           3,
      siblings_in_education: 1,
      has_chronic_illness:  false,
      mother_widow_pension: false,
    },
    financial: {
      total_annual_income:  120000,
      ration_card_type:     'BPL'  as const,
      loan_outstanding:     0,
      gold_value_inr:       15000,
      fixed_deposit_amount: 0,
    },
    assets: {
      total_asset_value: 25000,
      land_area_acres:   0,
      owns_land:         false,
      vehicle_count:     0,
      car_value:         0,
      electronics_value: 8000,
    },
    housing: {
      house_type:      'kuccha'  as const,
      ownership_type:  'owned'   as const,
      total_rooms:     1,
      has_electricity: false,
      has_piped_water: false,
      has_toilet:      false,
      has_lpg:         false,
    },
    benefits: {
      has_active_benefits: true,
      has_bpl_card:        true,
      has_aay_card:        false,
      has_mgnrega:         true,
      has_ayushman:        true,
      has_pm_schemes:      false,
    },
  },

  // 
  // Student 2: Rahul Kumar  Moderate candidate
  // OBC, urban, single parent (widowed mother), income 2.8L, semi-pucca rented
  // Expected: MODERATE composite (~5565)
  // 
  {
    user: {
      email: 'rahul.kumar.demo@scholarship.org',
      full_name: 'Rahul Kumar',
      phone: '9876543211',
    },
    personal: {
      date_of_birth:            new Date('2002-11-20'),
      gender:                   'Male',
      caste_category:           'OBC'  as const,
      religion_minority_status: false,
      is_differently_abled:     false,
      is_first_graduate:        true,
      father_status:            'deceased',
      mother_status:            'alive',
      is_single_parent:         true,
      is_orphan:                false,
      guardian_name:            undefined,
      guardian_annual_income:   undefined,
      residential_type:         'urban',
      state:                    'Tamil Nadu',
      district:                 'Chennai',
      pincode:                  '600028',
      enrollment_status:        'active' as const,
    },
    academic: {
      hsc_percentage:              72.0,
      hsc_board:                   'Tamil Nadu State Board',
      hsc_year:                    2021,
      ug_aggregate_pct:            65.5 as number | null,
      current_year_of_study:       2,
      course_type:                 'UG',
      course_name:                 'B.Sc. Mathematics',
      study_mode:                  'full_time' as const,
      active_arrears:              1,
      institution_code:            'GOVT_ARTS_CBE',
      receiving_other_scholarship: false,
      prev_awarded_by_trust:       false,
    },
    family: {
      family_size:           3,
      earning_members:       1,
      dependents:            2,
      siblings_in_education: 0,
      has_chronic_illness:   false,
      mother_widow_pension:  true,
    },
    financial: {
      total_annual_income:  280000,
      ration_card_type:     'BPL' as const,
      loan_outstanding:     50000,
      gold_value_inr:       30000,
      fixed_deposit_amount: 0,
    },
    assets: {
      total_asset_value: 45000,
      land_area_acres:   0,
      owns_land:         false,
      vehicle_count:     1,
      car_value:         0,
      electronics_value: 20000,
    },
    housing: {
      house_type:      'semi_pucca' as const,
      ownership_type:  'rented'     as const,
      total_rooms:     2,
      has_electricity: true,
      has_piped_water: true,
      has_toilet:      true,
      has_lpg:         true,
    },
    benefits: {
      has_active_benefits: true,
      has_bpl_card:        true,
      has_aay_card:        false,
      has_mgnrega:         false,
      has_ayushman:        true,
      has_pm_schemes:      false,
    },
  },

  // 
  // Student 3: Meena Devi  High need, lower merit
  // ST, tribal, AAY card, income 80K, kuccha, no utilities, 6 family members
  // Expected: HIGH need score, lower merit (first year  no UG marks yet)
  // 
  {
    user: {
      email: 'meena.devi.demo@scholarship.org',
      full_name: 'Meena Devi',
      phone: '9876543212',
    },
    personal: {
      date_of_birth:            new Date('2004-02-08'),
      gender:                   'Female',
      caste_category:           'ST'   as const,
      religion_minority_status: false,
      is_differently_abled:     false,
      is_first_graduate:        true,
      father_status:            'alive',
      mother_status:            'alive',
      is_single_parent:         false,
      is_orphan:                false,
      guardian_name:            undefined,
      guardian_annual_income:   undefined,
      residential_type:         'tribal',
      state:                    'Tamil Nadu',
      district:                 'Nilgiris',
      pincode:                  '643001',
      enrollment_status:        'active' as const,
    },
    academic: {
      hsc_percentage:              68.0,
      hsc_board:                   'Tamil Nadu State Board',
      hsc_year:                    2023,
      ug_aggregate_pct:            null as number | null, // First year  no UG marks
      current_year_of_study:       1,
      course_type:                 'UG',
      course_name:                 'B.A. Tamil Literature',
      study_mode:                  'full_time' as const,
      active_arrears:              0,
      institution_code:            'GOVT_ARTS_CBE',
      receiving_other_scholarship: false,
      prev_awarded_by_trust:       false,
    },
    family: {
      family_size:           6,
      earning_members:       1,
      dependents:            5,
      siblings_in_education: 2,
      has_chronic_illness:   true,
      mother_widow_pension:  false,
    },
    financial: {
      total_annual_income:  80000,
      ration_card_type:     'AAY' as const,
      loan_outstanding:     0,
      gold_value_inr:       5000,
      fixed_deposit_amount: 0,
    },
    assets: {
      total_asset_value: 10000,
      land_area_acres:   0.5,
      owns_land:         true,
      vehicle_count:     0,
      car_value:         0,
      electronics_value: 3000,
    },
    housing: {
      house_type:      'kuccha' as const,
      ownership_type:  'owned'  as const,
      total_rooms:     1,
      has_electricity: false,
      has_piped_water: false,
      has_toilet:      false,
      has_lpg:         false,
    },
    benefits: {
      has_active_benefits: true,
      has_bpl_card:        false,
      has_aay_card:        true,
      has_mgnrega:         true,
      has_ayushman:        true,
      has_pm_schemes:      true,
    },
  },

  // 
  // Student 4: Arjun Patel  Fraudulent application (ANOMALY TRIGGER)
  // General, urban  declares income 1.5L but owns:
  //   car_value  5,00,000   G-01 fires (income2L + car3L:  8 pts)
  //   gold_value 3,00,000   G-03 fires (income2L + gold2L: 6 pts)
  //   FD         2,00,000   G-04 fires (income2L + FD1L:   8 pts)
  // Expected: anomaly_flag = true  rejected in Phase 1
  // 
  {
    user: {
      email: 'arjun.patel.demo@scholarship.org',
      full_name: 'Arjun Patel',
      phone: '9876543213',
    },
    personal: {
      date_of_birth:            new Date('2001-07-30'),
      gender:                   'Male',
      caste_category:           'General' as const,
      religion_minority_status: false,
      is_differently_abled:     false,
      is_first_graduate:        false,
      father_status:            'alive',
      mother_status:            'alive',
      is_single_parent:         false,
      is_orphan:                false,
      guardian_name:            undefined,
      guardian_annual_income:   undefined,
      residential_type:         'urban',
      state:                    'Tamil Nadu',
      district:                 'Chennai',
      pincode:                  '600017',
      enrollment_status:        'active' as const,
    },
    academic: {
      hsc_percentage:              88.0,
      hsc_board:                   'CBSE',
      hsc_year:                    2020,
      ug_aggregate_pct:            81.0 as number | null,
      current_year_of_study:       4,
      course_type:                 'UG',
      course_name:                 'B.Tech Mechanical Engineering',
      study_mode:                  'full_time' as const,
      active_arrears:              0,
      institution_code:            'PSG_TECH',
      receiving_other_scholarship: false,
      prev_awarded_by_trust:       false,
    },
    family: {
      family_size:           4,
      earning_members:       2,
      dependents:            2,
      siblings_in_education: 1,
      has_chronic_illness:   false,
      mother_widow_pension:  false,
    },
    financial: {
      total_annual_income:  150000,   //  declared 1.5L (contradicted by assets)
      ration_card_type:     'none'   as const,
      loan_outstanding:     0,
      gold_value_inr:       300000,   //  3L gold   G-03 fires
      fixed_deposit_amount: 200000,   //  2L FD     G-04 fires
    },
    assets: {
      total_asset_value: 800000,
      land_area_acres:   0,
      owns_land:         false,
      vehicle_count:     2,
      car_value:         500000,      //  5L car    G-01 fires
      electronics_value: 80000,
    },
    housing: {
      house_type:      'flat_apartment' as const,
      ownership_type:  'owned'          as const,
      total_rooms:     3,
      has_electricity: true,
      has_piped_water: true,
      has_toilet:      true,
      has_lpg:         true,
    },
    benefits: {
      has_active_benefits: false,
      has_bpl_card:        false,
      has_aay_card:        false,
      has_mgnrega:         false,
      has_ayushman:        false,
      has_pm_schemes:      false,
    },
  },

  // 
  // Student 5: Kavitha Krishnan  Borderline moderate
  // OBC, rural, income 4.5L, 2 acres land, pucca owned, Ayushman only
  // Expected: LOWER-MODERATE composite (~4050)
  // 
  {
    user: {
      email: 'kavitha.krishnan.demo@scholarship.org',
      full_name: 'Kavitha Krishnan',
      phone: '9876543214',
    },
    personal: {
      date_of_birth:            new Date('2002-09-03'),
      gender:                   'Female',
      caste_category:           'OBC'  as const,
      religion_minority_status: false,
      is_differently_abled:     false,
      is_first_graduate:        false,
      father_status:            'alive',
      mother_status:            'alive',
      is_single_parent:         false,
      is_orphan:                false,
      guardian_name:            undefined,
      guardian_annual_income:   undefined,
      residential_type:         'rural',
      state:                    'Tamil Nadu',
      district:                 'Madurai',
      pincode:                  '625001',
      enrollment_status:        'active' as const,
    },
    academic: {
      hsc_percentage:              76.5,
      hsc_board:                   'Tamil Nadu State Board',
      hsc_year:                    2021,
      ug_aggregate_pct:            71.0 as number | null,
      current_year_of_study:       2,
      course_type:                 'UG',
      course_name:                 'B.Com Accounting',
      study_mode:                  'full_time' as const,
      active_arrears:              0,
      institution_code:            'GOVT_ARTS_CBE',
      receiving_other_scholarship: false,
      prev_awarded_by_trust:       false,
    },
    family: {
      family_size:           5,
      earning_members:       2,
      dependents:            3,
      siblings_in_education: 1,
      has_chronic_illness:   false,
      mother_widow_pension:  false,
    },
    financial: {
      total_annual_income:  450000,
      ration_card_type:     'none' as const,
      loan_outstanding:     80000,
      gold_value_inr:       50000,
      fixed_deposit_amount: 0,
    },
    assets: {
      total_asset_value: 300000,
      land_area_acres:   2.0,
      owns_land:         true,
      vehicle_count:     1,
      car_value:         0,
      electronics_value: 25000,
    },
    housing: {
      house_type:      'pucca_owned' as const,
      ownership_type:  'owned'       as const,
      total_rooms:     3,
      has_electricity: true,
      has_piped_water: true,
      has_toilet:      true,
      has_lpg:         true,
    },
    benefits: {
      has_active_benefits: true,
      has_bpl_card:        false,
      has_aay_card:        false,
      has_mgnrega:         false,
      has_ayushman:        true,
      has_pm_schemes:      false,
    },
  },
]

//  Helpers 

function hr(char = '', width = 72): string { return char.repeat(width) }
function pad(label: string, val: string | number | null, w = 32): string {
  return `  ${label.padEnd(w)} ${val ?? ''}`
}

//  Main 

async function main(): Promise<void> {
  console.log('\n' + hr(''))
  console.log('  SCHOLARSHIP PLATFORM  DEMO APPLICATION SEEDER')
  console.log('  5 Diverse Profiles  Full 3-Phase Pipeline')
  console.log(hr(''))

  // Load active program 
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true },
    orderBy: { created_at: 'desc' },
  })
  if (!program) {
    console.error('\n  No active scholarship program found. Run seed.ts first.\n')
    process.exit(1)
  }
  console.log(`\n  Program : ${program.program_name} (${program.program_code})`)
  console.log(`  Seats   : ${program.total_seats}  |  Shortlist cap: ${program.total_seats * 2}`)

  // Load institution map 
  const institutions = await prisma.institution.findMany()
  const instMap = new Map(institutions.map(i => [i.code, i.id]))

  // Shared password hash 
  const passwordHash = await bcrypt.hash('Demo@1234', 12)

  // Collect results for final summary 
  type Result = {
    name: string
    status: string
    anomaly_flag: boolean
    g_rules_fired: string[]
    anomaly_score: number
    merit: number | null
    need: number | null
    integrity: number | null
    composite: number | null
  }
  const results: Result[] = []

  //  Process each student 
  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i]!
    console.log('\n' + hr())
    console.log(`  [${i + 1}/5]  ${s.user.full_name}`)
    console.log(hr())

    // 1  Create / update user 
    const user = await prisma.user.upsert({
      where:  { email: s.user.email },
      update: { password_hash: passwordHash, full_name: s.user.full_name, phone: s.user.phone },
      create: {
        email: s.user.email, password_hash: passwordHash,
        full_name: s.user.full_name, phone: s.user.phone,
        role: 'student', is_active: true,
      },
    })
    console.log(pad('User ID:', user.id))

    // 2  Student Personal 
    await prisma.studentPersonal.upsert({
      where:  { user_id: user.id },
      update: {
        ...s.personal,
        guardian_name:          s.personal.guardian_name          ?? undefined,
        guardian_annual_income: s.personal.guardian_annual_income ?? undefined,
      },
      create: {
        user_id: user.id,
        ...s.personal,
        guardian_name:          s.personal.guardian_name          ?? undefined,
        guardian_annual_income: s.personal.guardian_annual_income ?? undefined,
      },
    })

    // 3  Student Academic 
    const institutionId = instMap.get(s.academic.institution_code)
    if (!institutionId) {
      console.error(`    Institution not found: ${s.academic.institution_code}`)
      continue
    }
    const { institution_code, ...acad } = s.academic
    await prisma.studentAcademic.upsert({
      where:  { user_id: user.id },
      update: { ...acad, institution_id: institutionId, ug_aggregate_pct: acad.ug_aggregate_pct ?? undefined },
      create: { user_id: user.id, ...acad, institution_id: institutionId, ug_aggregate_pct: acad.ug_aggregate_pct ?? undefined },
    })

    // 4  Student Family 
    await prisma.studentFamily.upsert({
      where:  { user_id: user.id },
      update: s.family,
      create: { user_id: user.id, ...s.family },
    })

    // 5  Student Financial 
    await prisma.studentFinancial.upsert({
      where:  { user_id: user.id },
      update: s.financial,
      create: { user_id: user.id, ...s.financial },
    })

    // 6  Student Assets 
    await prisma.studentAssets.upsert({
      where:  { user_id: user.id },
      update: s.assets,
      create: { user_id: user.id, ...s.assets },
    })

    // 7  Student Housing 
    await prisma.studentHousing.upsert({
      where:  { user_id: user.id },
      update: s.housing,
      create: { user_id: user.id, ...s.housing },
    })

    // 8  Student Govt Benefits 
    await prisma.studentGovtBenefits.upsert({
      where:  { user_id: user.id },
      update: s.benefits,
      create: { user_id: user.id, ...s.benefits },
    })

    // 9  Create Application (submitted state) 
    const app = await prisma.application.upsert({
      where:  { program_id_user_id: { program_id: program.id, user_id: user.id } },
      update: {
        status:             'submitted',
        anomaly_flag:       false,
        anomaly_score:      null,
        anomaly_reasons:    null,
        anomaly_checked_at: null,
        merit_score:        null,
        rule_need_score:    null,
        integrity_adj:      null,
        composite_score:    null,
        scored_at:          null,
        submitted_at:       new Date(),
        rejection_reason:   null,
      },
      create: {
        program_id:   program.id,
        user_id:      user.id,
        status:       'submitted',
        submitted_at: new Date(),
      },
    })
    console.log(pad('Application ID:', app.id))

    // 10  Phase 1: Anomaly Pre-Filter 
    console.log('\n   Phase 1  Anomaly Pre-Filter ...')
    try {
      await runAnomalyPreFilter(app.id)
    } catch (err) {
      console.error('   Phase 1 failed:', (err as Error).message)
    }

    let updated = await prisma.application.findUniqueOrThrow({ where: { id: app.id } })
    const reasons      = updated.anomaly_reasons as { g_rules_fired?: string[]; ml_flag?: boolean } | null
    const gRulesFired  = reasons?.g_rules_fired ?? []
    const anomalyScore = Number(updated.anomaly_score ?? 0)

    console.log(pad('  Status:', updated.status))
    console.log(pad('  Anomaly flag:', updated.anomaly_flag ? '  TRUE' : 'false'))
    console.log(pad('  Anomaly score (IF):', anomalyScore.toFixed(3)))
    if (gRulesFired.length > 0)
      console.log(pad('  G-rules fired:', gRulesFired.join(', ')))

    // 11  Phase 3: Rule Engine Scoring 
    if (updated.status === 'shortlisted') {
      console.log('\n   Phase 3  Rule Engine Scoring ...')
      try {
        const result = await runScoringEngine(app.id)
        updated = await prisma.application.findUniqueOrThrow({ where: { id: app.id } })
        console.log(pad('  Status:', updated.status))
        console.log(pad('  Merit score   (Domain A):', result.merit_score.toFixed(2) + ' / 100'))
        console.log(pad('  Need score    (BF):', result.rule_need_score.toFixed(2) + ' / 100'))
        console.log(pad('  Integrity adj (Domain G):', result.integrity_adj.toFixed(2)))
        console.log(pad('   COMPOSITE SCORE:', result.composite_score.toFixed(2) + ' / 100'))
      } catch (err) {
        console.error('   Phase 3 failed:', (err as Error).message)
      }
    }

    results.push({
      name:          s.user.full_name,
      status:        updated.status,
      anomaly_flag:  updated.anomaly_flag,
      g_rules_fired: gRulesFired,
      anomaly_score: anomalyScore,
      merit:       updated.merit_score    ? Number(updated.merit_score)    : null,
      need:        updated.rule_need_score ? Number(updated.rule_need_score) : null,
      integrity:   updated.integrity_adj   ? Number(updated.integrity_adj)   : null,
      composite:   updated.composite_score ? Number(updated.composite_score) : null,
    })
  }

  //  Final Summary 
  console.log('\n\n' + hr(''))
  console.log('  PIPELINE RESULTS  RANKED BY COMPOSITE SCORE')
  console.log(hr(''))
  console.log('  #  Applicant               Status                Merit   Need   Integrity  Composite')
  console.log('  ' + hr('-', 87))

  const ranked = [...results].sort((a, b) => (b.composite ?? -999) - (a.composite ?? -999))

  let rank = 0
  for (const r of ranked) {
    if (r.composite != null) rank++
    const prefix  = r.composite != null ? `${rank}.`.padStart(3) : '  '
    const name    = r.name.padEnd(22)
    const status  = r.status.padEnd(21)
    const merit   = r.merit     != null ? r.merit.toFixed(1).padStart(5)     : '    '
    const need    = r.need      != null ? r.need.toFixed(1).padStart(5)      : '    '
    const integ   = r.integrity != null ? r.integrity.toFixed(1).padStart(5) : '    '
    const comp    = r.composite != null ? r.composite.toFixed(1).padStart(9) : '         '
    const fraud   = r.anomaly_flag
      ? `   FRAUD [${r.g_rules_fired.join('+')}]`
      : ''
    console.log(`  ${prefix} ${name} ${status} ${merit}  ${need}   ${integ}${comp}${fraud}`)
  }

  console.log('  ' + hr('-', 87))

  console.log(`
  Notes:
   Composite = 0.35  Merit  +  0.65  Need  +  Integrity_adj
     FRAUD   = anomaly_flag true  rejected in Phase 1 (no scoring)
   ML G-08    = Isolation Forest (skipped if ML service not running)
   Shortlist  = Phase 2 gate: active enrollment + recognized institution

  Demo login credentials  (password: Demo@1234)
  `)

  for (const s of STUDENTS) {
    console.log(`  ${s.user.full_name.padEnd(26)} ${s.user.email}`)
  }

  console.log('\n' + hr('') + '\n')
}

main()
  .catch(e => { console.error('\n Fatal:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
