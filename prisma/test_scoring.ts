/**
 * End-to-end Rule Engine Test Script
 * Creates a test student, populates all 7 profile tables, submits an application,
 * runs scoring, and prints the full score breakdown.
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function test() {
  console.log('\n')
  console.log('  RULE ENGINE END-TO-END TEST')
  console.log('\n')

  // 1. Get active program
  const program = await prisma.scholarshipProgram.findFirst({ where: { is_active: true } })
  if (!program) { console.error('No active program found. Run seed first.'); return }
  console.log(` Program: ${program.program_name} (${program.program_code})`)

  // 2. Get a recognized institution
  const inst = await prisma.institution.findFirst({ where: { is_recognized: true } })
  if (!inst) { console.error('No institution found.'); return }
  console.log(` Institution: ${inst.name}`)

  // 3. Create test student user
  const email = `test_student_${Date.now()}@test.com`
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: await bcrypt.hash('Test@1234', 12),
      full_name: 'Priya Kumari',
      phone: '9876543210',
      role: 'student',
    },
  })
  console.log(` Student: ${user.full_name} (${email})`)

  // 4. Create all 7 student profile sub-tables
  // Profile: Poor, rural, SC, single parent, first-gen graduate
  await prisma.studentPersonal.create({
    data: {
      user_id: user.id,
      date_of_birth: new Date('2004-03-15'),
      gender: 'Female',
      caste_category: 'SC',
      religion_minority_status: false,
      is_differently_abled: false,
      is_first_graduate: true,
      father_status: 'deceased',
      mother_status: 'alive',
      is_single_parent: true,
      is_orphan: false,
      residential_type: 'rural',
      state: 'Tamil Nadu',
      district: 'Villupuram',
      pincode: '605602',
      enrollment_status: 'active',
    },
  })

  await prisma.studentAcademic.create({
    data: {
      user_id: user.id,
      hsc_percentage: 82.5,
      hsc_board: 'TN State Board',
      hsc_year: 2022,
      ug_aggregate_pct: 71.3,
      current_year_of_study: 3,
      course_type: 'engineering',
      course_name: 'B.E. Computer Science',
      study_mode: 'full_time',
      active_arrears: 1,
      institution_id: inst.id,
      receiving_other_scholarship: false,
      prev_awarded_by_trust: false,
    },
  })

  await prisma.studentFamily.create({
    data: {
      user_id: user.id,
      family_size: 5,
      earning_members: 1,
      dependents: 4,
      siblings_in_education: 2,
      has_chronic_illness: true,
      chronic_illness_details: 'Mother has diabetes',
      mother_widow_pension: true,
    },
  })

  await prisma.studentFinancial.create({
    data: {
      user_id: user.id,
      total_annual_income: 85000,
      income_source: 'Daily wage labour',
      employment_status: 'daily-wage',
      ration_card_type: 'BPL',
      loan_outstanding: 50000,
      gold_value_inr: 15000,
      fixed_deposit_amount: 0,
    },
  })

  await prisma.studentAssets.create({
    data: {
      user_id: user.id,
      total_asset_value: 35000,
      land_area_acres: 0,
      owns_land: false,
      vehicle_count: 0,
      car_value: 0,
      electronics_value: 8000,
    },
  })

  await prisma.studentHousing.create({
    data: {
      user_id: user.id,
      house_type: 'kuccha',
      ownership_type: 'rented',
      total_rooms: 1,
      has_electricity: true,
      has_piped_water: false,
      has_toilet: false,
      has_lpg: false,
    },
  })

  await prisma.studentGovtBenefits.create({
    data: {
      user_id: user.id,
      has_active_benefits: true,
      has_bpl_card: true,
      has_aay_card: false,
      has_mgnrega: true,
      has_ayushman: true,
      has_pm_schemes: false,
    },
  })

  console.log(' All 7 student profile tables populated')

  // 5. Create application (status: shortlisted  skipping anomaly check for test)
  const app = await prisma.application.create({
    data: {
      program_id: program.id,
      user_id: user.id,
      status: 'shortlisted',
      submitted_at: new Date(),
      anomaly_score: 0.22,
      anomaly_flag: false,
      anomaly_reasons: { g_rules_fired: [], ml_flag: false },
    },
  })
  console.log(` Application created: ${app.id} (status: shortlisted)`)

  // 6. Run scoring engine
  console.log('\n Running Rule Engine (Phase 3) \n')

  // Dynamic import to load the scoring engine
  const { runScoringEngine } = await import('../apps/api/src/services/scoring/ruleEngine')
  const result = await runScoringEngine(app.id)

  // 7. Print results
  console.log('')
  console.log('            SCORING RESULT  Priya Kumari             ')
  console.log('')
  console.log(`  Merit Score:       ${String(result.merit_score).padStart(6)}  / 100              `)
  console.log(`  Need Score (rule): ${String(result.rule_need_score).padStart(6)}  / 100              `)
  console.log(`  Integrity Adj:     ${String(result.integrity_adj).padStart(6)}  (cap: -40)          `)
  console.log(`   `)
  console.log(`  COMPOSITE:         ${String(result.composite_score).padStart(6)}  / 100              `)
  console.log('')

  console.log('\n Domain Breakdown \n')

  const bd = result.score_breakdown
  const domains = [
    { name: 'A  Academic Merit', data: bd.domain_a },
    { name: 'B  Income Need', data: bd.domain_b },
    { name: 'C  Family Need', data: bd.domain_c },
    { name: 'D  Assets Need', data: bd.domain_d },
    { name: 'E  Housing Need', data: bd.domain_e },
    { name: 'F  Social/Vulnerability', data: bd.domain_f },
    { name: 'G  Integrity Deductions', data: bd.domain_g },
  ]

  for (const dom of domains) {
    const entries = Object.entries(dom.data).filter(([, v]) => v !== 0)
    const total = Object.values(dom.data).reduce((s, v) => s + v, 0)
    console.log(`  ${dom.name}  (total: ${total.toFixed(1)} pts)`)
    for (const [code, pts] of entries) {
      const sign = pts >= 0 ? '+' : ''
      console.log(`    ${code}: ${sign}${pts}`)
    }
    if (entries.length === 0) console.log('    (no rules fired)')
    console.log()
  }

  // 8. Verify composite formula manually
  const expectedComposite = Math.min(Math.max(
    0.35 * result.merit_score + 0.65 * result.rule_need_score + result.integrity_adj,
    0), 100)
  console.log(' Formula Verification ')
  console.log(`  0.35  ${result.merit_score} + 0.65  ${result.rule_need_score} + (${result.integrity_adj})`)
  console.log(`  = ${(0.35 * result.merit_score).toFixed(2)} + ${(0.65 * result.rule_need_score).toFixed(2)} + (${result.integrity_adj})`)
  console.log(`  = ${expectedComposite.toFixed(2)}`)
  console.log(`  Engine returned: ${result.composite_score}`)
  console.log(`   Match: ${Math.abs(expectedComposite - result.composite_score) < 0.1 ? 'YES ' : 'NO '}\n`)

  // 9. Check the persisted application
  const updated = await prisma.application.findUnique({ where: { id: app.id } })
  console.log(' Persisted Application ')
  console.log(`  status:          ${updated?.status}`)
  console.log(`  merit_score:     ${updated?.merit_score}`)
  console.log(`  rule_need_score: ${updated?.rule_need_score}`)
  console.log(`  integrity_adj:   ${updated?.integrity_adj}`)
  console.log(`  composite_score: ${updated?.composite_score}`)
  console.log(`  scored_at:       ${updated?.scored_at}`)
  console.log()

  // Verify NO ml fields exist
  const rawApp = updated as Record<string, unknown>
  console.log(' ML Field Verification ')
  console.log(`  ml_need_score exists?     ${('ml_need_score' in rawApp) ? ' YES (BUG!)' : ' NO (correct)'}`)
  console.log(`  final_need_score exists?  ${('final_need_score' in rawApp) ? ' YES (BUG!)' : ' NO (correct)'}`)
  console.log(`  ml_blend_weight on program?  removed from schema `)

  console.log('\n')
  console.log('  TEST COMPLETE')
  console.log('\n')
}

test()
  .catch(e => { console.error('TEST FAILED:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
