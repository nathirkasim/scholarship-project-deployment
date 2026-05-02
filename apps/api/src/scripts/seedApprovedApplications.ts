/**
 * seedApprovedApplications.ts
 * Adds 2 students who pass the full pipeline and get approved.
 * Does NOT wipe existing data — appends only.
 *
 * Flow per student:
 *   submitted → anomaly pre-filter (clean) → scored → TOPSIS →
 *   verification_pending → field report (match ≥ 80%) →
 *   verification_complete → approved
 */

import * as path   from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import * as bcrypt   from 'bcryptjs'
import { PrismaClient, Prisma } from '@prisma/client'
import { runAnomalyPreFilter }           from '../services/anomaly/anomalyPreFilter'
import { runTOPSIS, applyVerificationMultiplier } from '../services/scoring/ruleEngine'

const prisma = new PrismaClient()
type InstCode = 'ANNA_UNIV' | 'IIT_MADRAS' | 'PSG_TECH' | 'GOVT_ARTS_CBE' | 'NIT_TRICHY'

const APPROVED_STUDENTS = [
  // A-1 — Kavitha Rajan: SC, orphan, tribal, kuccha, AAY, 88%
  // Designed to score very high on merit + need, clean on all G-rules
  {
    user: { email: 'kavitha.rajan@demo.appr', full_name: 'Kavitha Rajan', phone: '9300000001' },
    personal: {
      date_of_birth: new Date('2003-02-14'), gender: 'Female',
      caste_category: 'SC' as const, religion_minority_status: false,
      is_differently_abled: true, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'deceased',
      is_single_parent: false, is_orphan: true,
      guardian_name: 'Meenakshi Amma', guardian_annual_income: 45000,
      residential_type: 'tribal', state: 'Tamil Nadu', district: 'Dharmapuri', pincode: '636803',
      enrollment_status: 'active' as const,
    },
    academic: {
      hsc_percentage: 88.6, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 83.5, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.E. Computer Science',
      study_mode: 'full_time' as const, active_arrears: 0,
      institution_code: 'ANNA_UNIV' as InstCode,
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 3, earning_members: 1, dependents: 2, siblings_in_education: 0, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 55000, ration_card_type: 'AAY' as const, loan_outstanding: 0, gold_value_inr: 8000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 9000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 4000 },
    housing: { house_type: 'kuccha' as const, ownership_type: 'govt_allotted' as const, total_rooms: 1, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: true, has_mgnrega: true, has_ayushman: true, has_pm_schemes: true },
    // Field report — verifier confirms everything matches declared data (match ≥ 80%)
    fieldReport: {
      gps_latitude: 12.1232, gps_longitude: 78.1590,
      sec_a_identity_match: true,
      sec_b_housing_type_confirmed: 'kuccha',
      sec_b_ownership_confirmed: 'govt_allotted',
      sec_c_electricity: false,
      sec_c_water: false,
      sec_c_toilet: false,
      sec_c_lpg: false,
      sec_d_income_doc_present: true,
      sec_d_occupation_matches: true,
      sec_e_car_present: false,
      sec_e_vehicle_count_confirmed: 0,
      sec_e_gold_visible: false,
      sec_f_electronics_present: true,
      sec_g_land_present: false,
      sec_h_fd_docs_visible: false,
      sec_h_savings_visible: false,
      sec_i_all_docs_present: true,
      verifier_notes: 'Student lives with guardian in government-allotted kuccha house. All declarations verified. Genuine case.',
    },
  },

  // A-2 — Senthil Murugan: ST, single parent, BPL, semi-pucca, rural, 84%
  {
    user: { email: 'senthil.murugan@demo.appr', full_name: 'Senthil Murugan', phone: '9300000002' },
    personal: {
      date_of_birth: new Date('2002-08-25'), gender: 'Male',
      caste_category: 'ST' as const, religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'alive',
      is_single_parent: true, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Tiruvannamalai', pincode: '606601',
      enrollment_status: 'active' as const,
    },
    academic: {
      hsc_percentage: 84.2, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 78.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Civil Engineering',
      study_mode: 'full_time' as const, active_arrears: 0,
      institution_code: 'ANNA_UNIV' as InstCode,
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: true },
    financial: { total_annual_income: 95000, ration_card_type: 'BPL' as const, loan_outstanding: 18000, gold_value_inr: 10000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 22000, land_area_acres: 0.4, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 7000 },
    housing: { house_type: 'semi_pucca' as const, ownership_type: 'owned' as const, total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
    fieldReport: {
      gps_latitude: 12.2253, gps_longitude: 79.0747,
      sec_a_identity_match: true,
      sec_b_housing_type_confirmed: 'semi_pucca',
      sec_b_ownership_confirmed: 'owned',
      sec_c_electricity: true,
      sec_c_water: false,
      sec_c_toilet: false,
      sec_c_lpg: false,
      sec_d_income_doc_present: true,
      sec_d_occupation_matches: true,
      sec_e_car_present: false,
      sec_e_vehicle_count_confirmed: 0,
      sec_e_gold_visible: true,
      sec_f_electronics_present: true,
      sec_g_land_present: true,
      sec_h_fd_docs_visible: false,
      sec_h_savings_visible: false,
      sec_i_all_docs_present: true,
      verifier_notes: 'Single mother working as daily wage labourer. Documents in order. Small plot of agricultural land confirmed.',
    },
  },
]

const hr = (c = '─', w = 72) => c.repeat(w)

async function main() {
  console.log('\n' + hr())
  console.log('  APPROVED APPLICATIONS SEEDER  |  2 students → approved')
  console.log(hr())

  const program = await prisma.scholarshipProgram.findFirst({ where: { is_active: true }, orderBy: { created_at: 'desc' } })
  if (!program) { console.error('\n  No active program.\n'); process.exit(1) }

  const institutions = await prisma.institution.findMany()
  const instMap      = new Map(institutions.map(i => [i.code, i.id]))
  const verifier     = await prisma.user.findFirst({ where: { role: 'verifier' } })
  if (!verifier)     { console.error('\n  No verifier user. Run: npm run db:seed\n'); process.exit(1) }

  const adminUser  = await prisma.user.findFirst({ where: { role: 'super_admin' } })
  if (!adminUser)  { console.error('\n  No admin user.\n'); process.exit(1) }

  const passwordHash = await bcrypt.hash('Demo@1234', 12)
  console.log(`  Program : ${program.program_name}\n`)

  for (const s of APPROVED_STUDENTS) {
    console.log(`  ── ${s.user.full_name} ──`)

    // 1. Create user + profile
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

    const institutionId = instMap.get(s.academic.institution_code)!
    const { institution_code, ...acad } = s.academic
    await prisma.studentAcademic.upsert({
      where:  { user_id: user.id },
      update: { ...acad, institution_id: institutionId },
      create: { user_id: user.id, ...acad, institution_id: institutionId },
    })

    await prisma.studentFamily.upsert({ where: { user_id: user.id }, update: s.family, create: { user_id: user.id, ...s.family } })
    await prisma.studentFinancial.upsert({ where: { user_id: user.id }, update: s.financial, create: { user_id: user.id, ...s.financial } })
    await prisma.studentAssets.upsert({ where: { user_id: user.id }, update: s.assets, create: { user_id: user.id, ...s.assets } })
    await prisma.studentHousing.upsert({ where: { user_id: user.id }, update: s.housing, create: { user_id: user.id, ...s.housing } })
    await prisma.studentGovtBenefits.upsert({ where: { user_id: user.id }, update: s.benefits, create: { user_id: user.id, ...s.benefits } })

    // 2. Create application
    const app = await prisma.application.upsert({
      where:  { program_id_user_id: { program_id: program.id, user_id: user.id } },
      update: { status: 'submitted', anomaly_flag: false, anomaly_score: null, anomaly_reasons: Prisma.DbNull, merit_score: null, rule_need_score: null, integrity_adj: null, composite_score: null, scored_at: null, submitted_at: new Date(), rejection_reason: null, final_decision: null },
      create: { program_id: program.id, user_id: user.id, status: 'submitted', submitted_at: new Date() },
    })
    console.log(`    Created application ${app.id.slice(0, 8)}…`)

    // 3. Phase 1: anomaly pre-filter
    try { await runAnomalyPreFilter(app.id) } catch { /* ML offline */ }
    const afterAnomaly = await prisma.application.findUniqueOrThrow({ where: { id: app.id } })
    if (afterAnomaly.anomaly_flag) {
      console.log(`    ✗ Anomaly flagged — profile needs adjustment. Skipping.`); continue
    }
    console.log(`    ✓ Anomaly: clean (score ${Number(afterAnomaly.anomaly_score ?? 0).toFixed(3)})`)

    // 4. TOPSIS ranking across full cohort
    await runTOPSIS(program.id)
    const afterScore = await prisma.application.findUniqueOrThrow({ where: { id: app.id } })
    console.log(`    ✓ Scored  merit=${Number(afterScore.merit_score ?? 0).toFixed(1)}  need=${Number(afterScore.rule_need_score ?? 0).toFixed(1)}  TOPSIS=${Number(afterScore.composite_score ?? 0).toFixed(2)}`)

    // 5. Move to verification_pending + assign verifier
    await prisma.application.update({ where: { id: app.id }, data: { status: 'verification_pending' } })

    const assignment = await prisma.verificationAssignment.upsert({
      where:  { application_id: app.id },
      update: { verifier_id: verifier.id, assigned_at: new Date(), status: 'pending', verification_priority: 1 },
      create: { application_id: app.id, verifier_id: verifier.id, assigned_at: new Date(), status: 'pending', verification_priority: 1 },
    })
    console.log(`    ✓ Assigned to verifier ${verifier.full_name}`)

    // 6. Submit field report (all matching declared data → match ≥ 80%)
    const fr = s.fieldReport
    const declaredHousing  = s.housing
    const declaredAssets   = s.assets
    const declaredFinancial = s.financial

    const comparisons = [
      { match: fr.sec_a_identity_match === true },
      { match: !fr.sec_b_housing_type_confirmed || fr.sec_b_housing_type_confirmed === declaredHousing.house_type },
      { match: !fr.sec_b_ownership_confirmed    || fr.sec_b_ownership_confirmed    === declaredHousing.ownership_type },
      { match: (fr.sec_c_electricity === true) === declaredHousing.has_electricity },
      { match: (fr.sec_c_water       === true) === declaredHousing.has_piped_water },
      { match: (fr.sec_c_toilet      === true) === declaredHousing.has_toilet },
      { match: (fr.sec_c_lpg         === true) === declaredHousing.has_lpg },
      { match: fr.sec_d_income_doc_present  === true },
      { match: fr.sec_d_occupation_matches  === true },
      { match: (fr.sec_e_car_present  === true) === (Number(declaredAssets.car_value) > 0) },
      { match: Math.abs(Number(fr.sec_e_vehicle_count_confirmed ?? 0) - declaredAssets.vehicle_count) <= 1 },
      { match: (fr.sec_e_gold_visible === true) === (Number(declaredFinancial.gold_value_inr) > 0) },
      { match: (fr.sec_f_electronics_present === true) === (Number(declaredAssets.electronics_value) > 0) },
      { match: (fr.sec_g_land_present === true) === (Number(declaredAssets.land_area_acres) > 0) },
      { match: (fr.sec_h_fd_docs_visible  === true) === (Number(declaredFinancial.fixed_deposit_amount) > 0) },
      { match: fr.sec_h_savings_visible === true },
      { match: fr.sec_i_all_docs_present === true },
    ]
    const yes_count    = comparisons.filter(c => c.match).length
    const total_fields = comparisons.length
    const match_score  = Math.round((yes_count / total_fields) * 10000) / 100

    await prisma.verifierFieldReport.create({
      data: {
        assignment_id:                assignment.id,
        verifier_id:                  verifier.id,
        gps_latitude:                 fr.gps_latitude,
        gps_longitude:                fr.gps_longitude,
        sec_a_identity_match:         fr.sec_a_identity_match,
        sec_b_housing_type_confirmed: fr.sec_b_housing_type_confirmed,
        sec_b_ownership_confirmed:    fr.sec_b_ownership_confirmed,
        sec_c_electricity:            fr.sec_c_electricity,
        sec_c_water:                  fr.sec_c_water,
        sec_c_toilet:                 fr.sec_c_toilet,
        sec_c_lpg:                    fr.sec_c_lpg,
        sec_d_income_doc_present:     fr.sec_d_income_doc_present,
        sec_d_occupation_matches:     fr.sec_d_occupation_matches,
        sec_e_car_present:            fr.sec_e_car_present,
        sec_e_vehicle_count_confirmed: fr.sec_e_vehicle_count_confirmed,
        sec_e_gold_visible:           fr.sec_e_gold_visible,
        sec_f_electronics_present:    fr.sec_f_electronics_present,
        sec_g_land_present:           fr.sec_g_land_present,
        sec_h_fd_docs_visible:        fr.sec_h_fd_docs_visible,
        sec_h_savings_visible:        fr.sec_h_savings_visible,
        sec_i_all_docs_present:       fr.sec_i_all_docs_present,
        yes_count, total_fields, match_score,
        verifier_notes: fr.verifier_notes,
      },
    })

    await prisma.verificationAssignment.update({
      where: { id: assignment.id },
      data:  { status: 'complete', completed_at: new Date() },
    })
    console.log(`    ✓ Field report  match=${match_score}%  (${yes_count}/${total_fields} fields)`)

    // 7. Apply I-02/I-03/I-04 multiplier → sets status to verification_complete
    await applyVerificationMultiplier(app.id, program.id)
    const afterVerif = await prisma.application.findUniqueOrThrow({ where: { id: app.id } })
    console.log(`    ✓ Post-verify composite: ${Number(afterVerif.post_verify_composite ?? 0).toFixed(2)}`)

    // 8. Approve
    await prisma.application.update({
      where: { id: app.id },
      data: {
        final_decision:  'approved',
        status:          'approved',
        decided_by_id:   adminUser.id,
        decided_at:      new Date(),
        rejection_reason: null,
      },
    })
    await prisma.notification.create({
      data: {
        user_id:          user.id,
        application_id:   app.id,
        type:             'status_update',
        title:            'Application Approved',
        message:          'Congratulations! Your application has been approved for the scholarship.',
        is_read:          false,
      },
    })
    console.log(`    ✓ Status → approved`)
    console.log()
  }

  // Summary
  const all = await prisma.application.findMany({
    where:   { program_id: program.id },
    orderBy: { composite_score: 'desc' },
    include: { user: { select: { full_name: true } } },
  })

  const counts = all.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1; return acc
  }, {} as Record<string, number>)

  console.log(hr())
  console.log('  PROGRAMME SUMMARY')
  console.log(hr())
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([status, n]) => {
    console.log(`  ${status.padEnd(28)} ${n}`)
  })
  console.log(`  ${'TOTAL'.padEnd(28)} ${all.length}`)
  console.log('\n  Password: Demo@1234  |  Admin: admin@scholarship.org / Admin@1234')
  console.log(hr() + '\n')
}

main()
  .catch(e => { console.error('\n  Fatal:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
