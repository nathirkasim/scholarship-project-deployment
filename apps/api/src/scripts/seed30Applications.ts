/**
 * Full-Pipeline Seeder — 30 Diverse Student Profiles
 *
 * Distribution:
 *   15 selected for field verification
 *      9 → verification_complete (field report submitted)
 *      6 → verification_pending  (assigned, not yet visited)
 *    7 → anomaly_flagged   (Phase 1 G-rule violations)
 *    8 → not_shortlisted  (eligibility gate failures)
 *
 * Pipeline steps:
 *   1  Wipe: delete all applications, student profiles, student users
 *   2  Create 30 users + 7-table profiles + applications (status=submitted)
 *   3  runEvaluation for all 30 → anomaly_flagged / not_shortlisted / evaluated
 *   4  runTOPSIS on the 15 evaluated apps → scored
 *   5  selectForVerification → top 15 scored → verification_pending + verifier assignments
 *   6  Field reports for 9 apps + applyVerificationMultiplier → verification_complete
 *   7  Remaining 6 stay at verification_pending
 *
 * Run from apps/api/:
 *   npx tsx src/scripts/seed30Applications.ts
 *
 * Prerequisites:
 *   - Docker containers running (db, redis, ml-service optional)
 *   - DATABASE_URL set (loaded from root /.env)
 */

import * as path   from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import * as bcrypt from 'bcryptjs'
import { PrismaClient, Prisma } from '@prisma/client'
import { runEvaluation }                             from '../services/scoring/ruleEngine'
import { runTOPSIS, applyVerificationMultiplier, selectForVerification } from '../services/scoring/ruleEngine'

const prisma = new PrismaClient()

type InstCode = 'ANNA_UNIV' | 'IIT_MADRAS' | 'PSG_TECH' | 'GOVT_ARTS_CBE' | 'NIT_TRICHY'

interface StudentProfile {
  user:     { email: string; full_name: string; phone: string }
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

// ─────────────────────────────────────────────────────────────────────────────
//  30 Student Profiles
//  Profiles  1–15 : Verification cohort (scored → verification)
//  Profiles 16–22 : Anomaly rejected   (G-01 through G-07)
//  Profiles 23–30 : Eligibility failed  (inactive / part-time / other-scholarship / etc.)
// ─────────────────────────────────────────────────────────────────────────────

const STUDENTS: StudentProfile[] = [

  // ══════════════════════════════════════════════════════════════════════════
  //  VERIFICATION COHORT (1–15)  —  profiles designed to score high enough
  //  to clear the 40-pt TOPSIS threshold and get selected for verification.
  //  Profiles 1–9  will become verification_complete.
  //  Profiles 10–15 will stay verification_pending.
  // ══════════════════════════════════════════════════════════════════════════

  // 1  Priya Meena: SC orphan, BPL, kuccha, rural, engineering 85%
  {
    user: { email: 'priya.meena@seed30.sc', full_name: 'Priya Meena', phone: '9200000001' },
    personal: {
      date_of_birth: new Date('2003-05-14'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'deceased',
      is_single_parent: false, is_orphan: true,
      guardian_name: 'Kamala Devi', guardian_annual_income: 55000,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Villupuram', pincode: '605602',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 85.4, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 79.2, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Computer Science',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 120000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 15000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 25000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 8000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 1, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 2  Murugan Chelvan: ST tribal, AAY, 7-member, chronic illness, 73%
  {
    user: { email: 'murugan.chelvan@seed30.sc', full_name: 'Murugan Chelvan', phone: '9200000002' },
    personal: {
      date_of_birth: new Date('2004-01-20'), gender: 'Male',
      caste_category: 'ST', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'tribal', state: 'Tamil Nadu', district: 'Nilgiris', pincode: '643001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 73.0, hsc_board: 'TN Board', hsc_year: 2023,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.Sc. Agriculture',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 7, earning_members: 1, dependents: 6, siblings_in_education: 3, has_chronic_illness: true, mother_widow_pension: false },
    financial: { total_annual_income: 70000, ration_card_type: 'AAY', loan_outstanding: 0, gold_value_inr: 5000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 12000, land_area_acres: 0.4, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 3000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 1, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: true, has_mgnrega: true, has_ayushman: true, has_pm_schemes: true },
  },

  // 3  Lakshmi Selvi: SC, differently-abled, single parent (father deceased), BPL, 78%
  {
    user: { email: 'lakshmi.selvi@seed30.sc', full_name: 'Lakshmi Selvi', phone: '9200000003' },
    personal: {
      date_of_birth: new Date('2003-08-10'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: true, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'alive',
      is_single_parent: true, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Tirunelveli', pincode: '627001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 78.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 72.5, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.A. Social Work',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: true },
    financial: { total_annual_income: 90000, ration_card_type: 'BPL', loan_outstanding: 20000, gold_value_inr: 10000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 18000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 6000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 4  Anbu Raja: ST tribal orphan, first-gen, 82% HSC, income ₹60K
  {
    user: { email: 'anbu.raja@seed30.sc', full_name: 'Anbu Raja', phone: '9200000004' },
    personal: {
      date_of_birth: new Date('2002-12-05'), gender: 'Male',
      caste_category: 'ST', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'deceased',
      is_single_parent: false, is_orphan: true,
      guardian_name: 'Village Elder', guardian_annual_income: 40000,
      residential_type: 'tribal', state: 'Tamil Nadu', district: 'Dharmapuri', pincode: '636701',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 82.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 76.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Civil Engineering',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 3, earning_members: 1, dependents: 2, siblings_in_education: 0, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 60000, ration_card_type: 'AAY', loan_outstanding: 0, gold_value_inr: 5000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 8000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 4000 },
    housing: { house_type: 'kuccha', ownership_type: 'govt_allotted', total_rooms: 1, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: true, has_mgnrega: true, has_ayushman: true, has_pm_schemes: true },
  },

  // 5  Fatima Nisha: Muslim minority + SC, BPL, kuccha rented, income ₹80K, 80%
  {
    user: { email: 'fatima.nisha@seed30.sc', full_name: 'Fatima Nisha', phone: '9200000005' },
    personal: {
      date_of_birth: new Date('2003-03-22'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: true,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Vellore', pincode: '632001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 80.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 74.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.A. English Literature',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 6, earning_members: 1, dependents: 5, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 80000, ration_card_type: 'BPL', loan_outstanding: 15000, gold_value_inr: 10000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 15000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 5000 },
    housing: { house_type: 'kuccha', ownership_type: 'rented', total_rooms: 1, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 6  Kamala Devi: SC, widow pension, BPL+MGNREGA, single parent, kuccha, 80%
  {
    user: { email: 'kamala.devi@seed30.sc', full_name: 'Kamala Devi', phone: '9200000006' },
    personal: {
      date_of_birth: new Date('2003-07-18'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'alive',
      is_single_parent: true, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Cuddalore', pincode: '607001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 80.5, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 75.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.Sc. Nursing',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 3, earning_members: 1, dependents: 2, siblings_in_education: 0, has_chronic_illness: false, mother_widow_pension: true },
    financial: { total_annual_income: 90000, ration_card_type: 'BPL', loan_outstanding: 10000, gold_value_inr: 8000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 20000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 7000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 7  Thiruvengadam: OBC, rural, BPL, first-gen, chronic illness in family, 76%
  {
    user: { email: 'thiruvengadam@seed30.sc', full_name: 'Thiruvengadam K', phone: '9200000007' },
    personal: {
      date_of_birth: new Date('2003-11-25'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Pudukkottai', pincode: '622001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 76.2, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 70.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.Com Accounting',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 6, earning_members: 1, dependents: 5, siblings_in_education: 2, has_chronic_illness: true, mother_widow_pension: false },
    financial: { total_annual_income: 100000, ration_card_type: 'BPL', loan_outstanding: 25000, gold_value_inr: 8000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 22000, land_area_acres: 0.3, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 6000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 8  Suganya Pandi: ST tribal, AAY, no utilities, 7-member, 74%
  {
    user: { email: 'suganya.pandi@seed30.sc', full_name: 'Suganya Pandi', phone: '9200000008' },
    personal: {
      date_of_birth: new Date('2004-04-30'), gender: 'Female',
      caste_category: 'ST', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'tribal', state: 'Tamil Nadu', district: 'Salem', pincode: '636001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 74.0, hsc_board: 'TN Board', hsc_year: 2023,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.Sc. Botany',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 7, earning_members: 1, dependents: 6, siblings_in_education: 4, has_chronic_illness: true, mother_widow_pension: false },
    financial: { total_annual_income: 65000, ration_card_type: 'AAY', loan_outstanding: 0, gold_value_inr: 5000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 10000, land_area_acres: 0.3, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 2500 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 1, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: true, has_mgnrega: true, has_ayushman: true, has_pm_schemes: true },
  },

  // 9  Ravi Kumar: OBC, rural, single parent (father deceased), widow pension, BPL, 77%
  //    → verification_complete (last of the 9)
  {
    user: { email: 'ravi.kumar@seed30.sc', full_name: 'Ravi Kumar', phone: '9200000009' },
    personal: {
      date_of_birth: new Date('2003-09-05'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'alive',
      is_single_parent: true, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Thanjavur', pincode: '613001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 77.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 71.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.Sc. Chemistry',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: true },
    financial: { total_annual_income: 110000, ration_card_type: 'BPL', loan_outstanding: 30000, gold_value_inr: 12000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 28000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 8000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 10  Bindhu Raj: SC, BPL, semi-pucca, rural, first-gen, 72%
  //     → verification_pending (first of the 6)
  {
    user: { email: 'bindhu.raj@seed30.sc', full_name: 'Bindhu Raj', phone: '9200000010' },
    personal: {
      date_of_birth: new Date('2003-06-14'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Krishnagiri', pincode: '635001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 72.0, hsc_board: 'TN Board', hsc_year: 2023,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.A. Economics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 130000, ration_card_type: 'BPL', loan_outstanding: 15000, gold_value_inr: 12000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 30000, land_area_acres: 0.2, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 9000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 11  Sethupathi A: OBC, rural, BPL, chronic illness, 71%
  {
    user: { email: 'sethupathi.a@seed30.sc', full_name: 'Sethupathi A', phone: '9200000011' },
    personal: {
      date_of_birth: new Date('2003-02-19'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Perambalur', pincode: '621212',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 71.5, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 66.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.Sc. Mathematics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 2, dependents: 3, siblings_in_education: 1, has_chronic_illness: true, mother_widow_pension: false },
    financial: { total_annual_income: 160000, ration_card_type: 'BPL', loan_outstanding: 35000, gold_value_inr: 14000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 38000, land_area_acres: 0.5, owns_land: true, vehicle_count: 1, car_value: 0, electronics_value: 10000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 12  Nirmala Pandi: NT (Nomadic Tribe), rural, semi-pucca, single earner, 70%
  {
    user: { email: 'nirmala.pandi@seed30.sc', full_name: 'Nirmala Pandi', phone: '9200000012' },
    personal: {
      date_of_birth: new Date('2003-08-08'), gender: 'Female',
      caste_category: 'NT', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Ramanathapuram', pincode: '623501',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 70.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 65.5, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.A. Tamil Literature',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 140000, ration_card_type: 'OPH', loan_outstanding: 20000, gold_value_inr: 10000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 32000, land_area_acres: 0.2, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 8000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 13  Shankar Das: OBC, urban, single parent (mother deceased), widow, 74%
  {
    user: { email: 'shankar.das@seed30.sc', full_name: 'Shankar Das', phone: '9200000013' },
    personal: {
      date_of_birth: new Date('2002-11-11'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'deceased',
      is_single_parent: true, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Madurai', pincode: '625001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 74.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 67.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Mechanical',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 180000, ration_card_type: 'OPH', loan_outstanding: 40000, gold_value_inr: 20000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 45000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 12000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 14  Kavitha Raj: SC, pucca_rented, BPL, rural, first-gen, 73%
  {
    user: { email: 'kavitha.raj@seed30.sc', full_name: 'Kavitha Raj', phone: '9200000014' },
    personal: {
      date_of_birth: new Date('2003-01-25'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Tiruvannamalai', pincode: '606601',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 73.5, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 68.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.Sc. Physics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 2, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 170000, ration_card_type: 'BPL', loan_outstanding: 25000, gold_value_inr: 15000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 35000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 10000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 15  Saravanan P: OBC, urban, BPL, first-gen, lower income, 76%
  {
    user: { email: 'saravanan.p@seed30.sc', full_name: 'Saravanan P', phone: '9200000015' },
    personal: {
      date_of_birth: new Date('2003-04-18'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Coimbatore', pincode: '641001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 76.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 70.5, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.Com Finance',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 150000, ration_card_type: 'BPL', loan_outstanding: 20000, gold_value_inr: 12000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 32000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 9000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'rented', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ANOMALY REJECTED (16–22) — G-rule violations
  //  Each profile triggers exactly one G-rule so the reason is explicit.
  // ══════════════════════════════════════════════════════════════════════════

  // 16  G-01: Low income (₹1.5L) + expensive car (₹3.5L) — car fraud
  {
    user: { email: 'kumar.rajan@seed30.sc', full_name: 'Kumar Rajan', phone: '9200000016' },
    personal: {
      date_of_birth: new Date('2002-06-10'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Erode', pincode: '638001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 70.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 65.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Electrical',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 0, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 150000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 10000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 400000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 350000, electronics_value: 15000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: false, has_pm_schemes: false },
  },

  // 17  G-02: Low income (₹1.8L) + high electronics (₹60K) — electronics fraud
  {
    user: { email: 'mala.raj@seed30.sc', full_name: 'Mala Raj', phone: '9200000017' },
    personal: {
      date_of_birth: new Date('2003-03-15'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Karur', pincode: '639001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 75.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.Sc. Computer Science',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 180000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 5000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 90000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 62000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: false, has_pm_schemes: false },
  },

  // 18  G-03: Low income (₹1.5L) + high gold (₹2.5L) — gold declaration fraud
  {
    user: { email: 'sundaram.v@seed30.sc', full_name: 'Sundaram V', phone: '9200000018' },
    personal: {
      date_of_birth: new Date('2002-09-22'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Namakkal', pincode: '637001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 68.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 63.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Chemistry',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 0, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 150000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 250000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 280000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 10000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: false, has_pm_schemes: false },
  },

  // 19  G-04: Low income (₹1.2L) + large FD (₹1.5L) — hidden savings fraud
  {
    user: { email: 'vijayalakshmi@seed30.sc', full_name: 'Vijayalakshmi S', phone: '9200000019' },
    personal: {
      date_of_birth: new Date('2003-07-07'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Sivaganga', pincode: '630001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 72.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.A. English',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 120000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 15000, fixed_deposit_amount: 150000 },
    assets: { total_asset_value: 180000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 8000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: false, has_pm_schemes: false },
  },

  // 20  G-05: Kuccha house + high total assets (₹1.2L) — housing inconsistency
  {
    user: { email: 'ramu.nair@seed30.sc', full_name: 'Ramu Nair', phone: '9200000020' },
    personal: {
      date_of_birth: new Date('2002-04-12'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Virudhunagar', pincode: '626001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 69.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 64.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Agriculture',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 2, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 280000, ration_card_type: 'none', loan_outstanding: 50000, gold_value_inr: 30000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 120000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 20000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 1, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 21  G-06: Rented house + owns land — contradictory ownership claim
  {
    user: { email: 'thilaga.r@seed30.sc', full_name: 'Thilaga R', phone: '9200000021' },
    personal: {
      date_of_birth: new Date('2003-12-18'), gender: 'Female',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Tiruchirappalli', pincode: '620001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 71.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 66.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.Sc. Zoology',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 2, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 220000, ration_card_type: 'OPH', loan_outstanding: 40000, gold_value_inr: 20000, fixed_deposit_amount: 10000 },
    assets: { total_asset_value: 85000, land_area_acres: 1.5, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 15000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: false },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 22  G-07: Active government benefits (BPL) but income ₹5.5L — benefit fraud
  {
    user: { email: 'ramachandran.k@seed30.sc', full_name: 'Ramachandran K', phone: '9200000022' },
    personal: {
      date_of_birth: new Date('2001-08-05'), gender: 'Male',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600018',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 75.0, hsc_board: 'CBSE', hsc_year: 2020,
      ug_aggregate_pct: 70.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.Tech IT',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'PSG_TECH',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 550000, ration_card_type: 'BPL', loan_outstanding: 80000, gold_value_inr: 40000, fixed_deposit_amount: 20000 },
    assets: { total_asset_value: 200000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 40000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: true },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ELIGIBILITY REJECTED (23–30) — Gate failures → not_shortlisted
  //  Each profile fails exactly one eligibility gate.
  // ══════════════════════════════════════════════════════════════════════════

  // 23  Gate A: Enrollment inactive — #1
  {
    user: { email: 'manoj.patel@seed30.sc', full_name: 'Manoj Patel', phone: '9200000023' },
    personal: {
      date_of_birth: new Date('2002-03-10'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600001',
      enrollment_status: 'inactive',   // ← Gate A fails
    },
    academic: {
      hsc_percentage: 68.0, hsc_board: 'CBSE', hsc_year: 2021,
      ug_aggregate_pct: 63.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.B.A.',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 350000, ration_card_type: 'none', loan_outstanding: 60000, gold_value_inr: 30000, fixed_deposit_amount: 10000 },
    assets: { total_asset_value: 150000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 25000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 24  Gate A: Enrollment inactive — #2 (different background)
  {
    user: { email: 'kaveri.devi@seed30.sc', full_name: 'Kaveri Devi', phone: '9200000024' },
    personal: {
      date_of_birth: new Date('2003-07-14'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Tiruppur', pincode: '641601',
      enrollment_status: 'inactive',   // ← Gate A fails
    },
    academic: {
      hsc_percentage: 71.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.Sc. Botany',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 2, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 200000, ration_card_type: 'OPH', loan_outstanding: 20000, gold_value_inr: 15000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 60000, land_area_acres: 0.3, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 12000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 25  Gate D: Part-time study mode
  {
    user: { email: 'senthil.raj@seed30.sc', full_name: 'Senthil Raj', phone: '9200000025' },
    personal: {
      date_of_birth: new Date('2001-11-20'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Coimbatore', pincode: '641002',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 65.0, hsc_board: 'TN Board', hsc_year: 2020,
      ug_aggregate_pct: 60.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Com General',
      study_mode: 'part_time',         // ← Gate D fails
      active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 0, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 300000, ration_card_type: 'none', loan_outstanding: 40000, gold_value_inr: 25000, fixed_deposit_amount: 15000 },
    assets: { total_asset_value: 120000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 30000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 26  Gate D: Distance education
  {
    user: { email: 'anandhi.k@seed30.sc', full_name: 'Anandhi K', phone: '9200000026' },
    personal: {
      date_of_birth: new Date('2001-05-28'), gender: 'Female',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600040',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 68.0, hsc_board: 'CBSE', hsc_year: 2020,
      ug_aggregate_pct: 63.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.A. Psychology',
      study_mode: 'distance',           // ← Gate D fails
      active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 420000, ration_card_type: 'none', loan_outstanding: 60000, gold_value_inr: 40000, fixed_deposit_amount: 20000 },
    assets: { total_asset_value: 180000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 35000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 27  Gate E: Receiving another scholarship — #1
  {
    user: { email: 'jeeva.kumar@seed30.sc', full_name: 'Jeeva Kumar', phone: '9200000027' },
    personal: {
      date_of_birth: new Date('2002-08-30'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Trichy', pincode: '620003',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 78.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 73.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Electronics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'NIT_TRICHY',
      receiving_other_scholarship: true,  // ← Gate E fails
      prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 380000, ration_card_type: 'none', loan_outstanding: 60000, gold_value_inr: 30000, fixed_deposit_amount: 15000 },
    assets: { total_asset_value: 160000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 28000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 28  Gate E: Receiving another scholarship — #2 (different background)
  {
    user: { email: 'pooja.sharma@seed30.sc', full_name: 'Pooja Sharma', phone: '9200000028' },
    personal: {
      date_of_birth: new Date('2002-02-14'), gender: 'Female',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600030',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 82.0, hsc_board: 'CBSE', hsc_year: 2021,
      ug_aggregate_pct: 76.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Tech CSE',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'PSG_TECH',
      receiving_other_scholarship: true,  // ← Gate E fails
      prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 480000, ration_card_type: 'none', loan_outstanding: 90000, gold_value_inr: 50000, fixed_deposit_amount: 30000 },
    assets: { total_asset_value: 250000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 40000 },
    housing: { house_type: 'flat_apartment', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 29  Gate F: Previously awarded by this trust
  {
    user: { email: 'balaji.sub@seed30.sc', full_name: 'Balaji Subramanian', phone: '9200000029' },
    personal: {
      date_of_birth: new Date('2001-10-05'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Madurai', pincode: '625002',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 76.0, hsc_board: 'TN Board', hsc_year: 2020,
      ug_aggregate_pct: 71.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.Sc. Statistics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false,
      prev_awarded_by_trust: true,        // ← Gate F fails
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 0, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 320000, ration_card_type: 'none', loan_outstanding: 50000, gold_value_inr: 25000, fixed_deposit_amount: 10000 },
    assets: { total_asset_value: 130000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 22000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 30  Gate G: 6 active arrears (> 5 limit)
  {
    user: { email: 'muthu.pandian@seed30.sc', full_name: 'Muthu Pandian', phone: '9200000030' },
    personal: {
      date_of_birth: new Date('2001-01-17'), gender: 'Male',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600050',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 62.0, hsc_board: 'TN Board', hsc_year: 2020,
      ug_aggregate_pct: 55.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.E. Civil',
      study_mode: 'full_time',
      active_arrears: 6,                  // ← Gate G fails (> 5)
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 400000, ration_card_type: 'none', loan_outstanding: 70000, gold_value_inr: 35000, fixed_deposit_amount: 20000 },
    assets: { total_asset_value: 170000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 32000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hr = (c = '═', w = 76) => c.repeat(w)
const pad = (l: string, v: string | number | null, w = 34) => `  ${l.padEnd(w)} ${v ?? ''}`

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + hr())
  console.log('  SCHOLARSHIP PLATFORM  30-APPLICATION FULL-PIPELINE SEEDER')
  console.log('  7 anomaly  8 eligibility  15 verification (9 complete + 6 pending)')
  console.log(hr())

  // ── Step 1: Wipe ──────────────────────────────────────────────────────────
  console.log('\n  [1/7] Wiping existing student data...')
  await prisma.verifierFieldReport.deleteMany({})
  await prisma.verificationAssignment.deleteMany({})
  await prisma.applicationStatusLog.deleteMany({})
  await prisma.document.deleteMany({})
  await prisma.notification.deleteMany({})
  await prisma.application.deleteMany({})
  await prisma.studentGovtBenefits.deleteMany({})
  await prisma.studentHousing.deleteMany({})
  await prisma.studentAssets.deleteMany({})
  await prisma.studentFinancial.deleteMany({})
  await prisma.studentFamily.deleteMany({})
  await prisma.studentAcademic.deleteMany({})
  await prisma.studentPersonal.deleteMany({})
  await prisma.user.deleteMany({ where: { role: 'student' } })
  console.log('   ✓ Wiped all student users, profiles, and applications')

  // ── Step 2: Load dependencies ─────────────────────────────────────────────
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { console.error('\n   ✗ No active program found. Run: npm run db:seed\n'); process.exit(1) }

  const institutions = await prisma.institution.findMany()
  const instMap = new Map(institutions.map(i => [i.code, i.id]))

  const verifier = await prisma.user.findFirst({ where: { role: 'verifier' } })
  if (!verifier) { console.error('\n   ✗ No verifier user found. Run: npm run db:seed\n'); process.exit(1) }

  const passwordHash = await bcrypt.hash('Demo@1234', 12)

  console.log(`  Program   : ${program.program_name} (${program.academic_year})`)
  console.log(`  Verifier  : ${verifier.full_name}`)
  console.log(`  Students  : ${STUDENTS.length}`)

  // ── Step 3: Create users, profiles, applications ──────────────────────────
  console.log('\n  [2/7] Creating 30 users, profiles, and applications...')
  const applicationIds: string[] = []

  for (const s of STUDENTS) {
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
    if (!institutionId) { console.error(`   ✗ Institution not found: ${s.academic.institution_code}`); continue }
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
    applicationIds.push(app.id)
    process.stdout.write('.')
  }
  console.log(`\n   ✓ Created ${applicationIds.length} applications`)

  // ── Step 4: Run evaluation pipeline for all 30 ───────────────────────────
  console.log('\n  [3/7] Running evaluation pipeline (anomaly + eligibility + scoring)...')
  let anomalyCount = 0
  let notShortlistCount = 0
  let evaluatedCount = 0

  for (const appId of applicationIds) {
    try {
      await runEvaluation(appId)
    } catch (err) {
      console.error(`   ✗ Evaluation error for ${appId}: ${err}`)
    }
    const a = await prisma.application.findUniqueOrThrow({ where: { id: appId } })
    if (a.status === 'anomaly_flagged')  anomalyCount++
    else if (a.status === 'not_shortlisted') notShortlistCount++
    else if (a.status === 'evaluated')   evaluatedCount++
    process.stdout.write('.')
  }
  console.log(`\n   ✓ Evaluation complete`)
  console.log(`     anomaly_flagged   : ${anomalyCount}`)
  console.log(`     not_shortlisted   : ${notShortlistCount}`)
  console.log(`     evaluated         : ${evaluatedCount}`)

  // ── Step 5: TOPSIS batch ranking ─────────────────────────────────────────
  console.log('\n  [4/7] TOPSIS batch ranking (cohort normalisation)...')
  await runTOPSIS(program.id)
  const scoredCount = await prisma.application.count({ where: { program_id: program.id, status: 'scored' } })
  console.log(`   ✓ TOPSIS complete — ${scoredCount} applications scored`)

  // ── Step 6: Select top 15 for verification ───────────────────────────────
  console.log('\n  [5/7] Selecting top candidates for field verification...')
  await selectForVerification(program.id)
  const pendingVerifCount = await prisma.application.count({ where: { program_id: program.id, status: 'verification_pending' } })
  console.log(`   ✓ ${pendingVerifCount} applications at verification_pending`)

  // ── Step 7: Field reports for 9 apps → verification_complete ─────────────
  console.log('\n  [6/7] Simulating field verification for top 9 applications...')

  // Load all verification_pending apps sorted by composite_score DESC
  const verifApps = await prisma.application.findMany({
    where:   { program_id: program.id, status: 'verification_pending' },
    orderBy: { composite_score: 'desc' },
    select:  { id: true, composite_score: true, verification_assignment: { select: { id: true } } },
  })

  const COMPLETE_COUNT = 9

  for (let i = 0; i < Math.min(COMPLETE_COUNT, verifApps.length); i++) {
    const app        = verifApps[i]!
    const assignment = app.verification_assignment
    if (!assignment) {
      console.warn(`   ⚠ No assignment found for app ${app.id}, skipping field report`)
      continue
    }

    // Top 9 → 85%+ match (I-02: no penalty), bottom remainder → 60% (I-03: ×0.85)
    const matchScore = 85
    const isTop      = true

    await prisma.verificationAssignment.update({
      where: { id: assignment.id },
      data:  { status: 'complete', completed_at: new Date() },
    })

    await prisma.verifierFieldReport.create({
      data: {
        assignment_id:             assignment.id,
        verifier_id:               verifier.id,
        match_score:               matchScore,
        gps_latitude:              11.1271,
        gps_longitude:             78.6569,
        submitted_at:              new Date(),
        verifier_notes:            'All declarations verified and matched on-site.',
        sec_a_identity_match:      true,
        sec_b_housing_type_confirmed: null,
        sec_c_electricity:         isTop,
        sec_c_water:               isTop,
        sec_c_toilet:              false,
        sec_c_lpg:                 false,
        sec_d_income_doc_present:  true,
        sec_d_occupation_matches:  true,
        sec_e_car_present:         false,
        sec_e_gold_visible:        false,
        sec_f_electronics_present: false,
        sec_g_land_present:        false,
        sec_h_fd_docs_visible:     false,
        sec_h_savings_visible:     false,
        sec_i_all_docs_present:    true,
        yes_count:                 8,
        total_fields:              10,
      },
    })

    await applyVerificationMultiplier(app.id, program.id)
    process.stdout.write('✓')
  }

  console.log(`\n   ✓ ${Math.min(COMPLETE_COUNT, verifApps.length)} field reports submitted`)

  const finalVerifComplete = await prisma.application.count({ where: { program_id: program.id, status: 'verification_complete' } })
  const finalVerifPending  = await prisma.application.count({ where: { program_id: program.id, status: 'verification_pending' } })
  console.log(`   ✓ verification_complete : ${finalVerifComplete}`)
  console.log(`   ✓ verification_pending  : ${finalVerifPending}`)

  // ── Final Summary ─────────────────────────────────────────────────────────
  const allApps = await prisma.application.findMany({
    where:   { program_id: program.id },
    orderBy: [{ composite_rank: 'asc' }, { created_at: 'asc' }],
    include: { user: { select: { full_name: true } } },
  })

  console.log('\n\n' + hr())
  console.log('  FINAL PIPELINE RESULTS — 30 APPLICATIONS')
  console.log(hr())
  console.log('  Status Breakdown:')

  const statusCounts = allApps.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  for (const [status, count] of Object.entries(statusCounts).sort()) {
    console.log(`    ${status.padEnd(28)} ${count}`)
  }

  console.log('\n  Scored / Verification Cohort (by composite rank):')
  console.log('  Rk  Name                     Merit   Need  Integ  TOPSIS  Status')
  console.log('  ' + '─'.repeat(72))

  for (const a of allApps.filter(x => x.composite_rank)) {
    const name   = a.user.full_name.padEnd(24)
    const merit  = a.merit_score     != null ? Number(a.merit_score).toFixed(1).padStart(6)     : '     '
    const need   = a.rule_need_score != null ? Number(a.rule_need_score).toFixed(1).padStart(6) : '     '
    const integ  = a.integrity_adj   != null ? Number(a.integrity_adj).toFixed(1).padStart(6)   : '     '
    const topsis = a.composite_score != null ? Number(a.composite_score).toFixed(2).padStart(7) : '      '
    const status = a.status.padEnd(22)
    console.log(`  ${String(a.composite_rank).padStart(2)}  ${name} ${merit}  ${need}  ${integ}  ${topsis}  ${status}`)
  }

  console.log('\n  Anomaly Rejected (Phase 1 — G-rule violations):')
  for (const a of allApps.filter(x => x.status === 'anomaly_flagged')) {
    const reasons = (a.anomaly_reasons as any)?.g_rules_fired ?? []
    console.log(`      ${a.user.full_name.padEnd(26)} Rules: [${reasons.join(', ')}]`)
  }

  console.log('\n  Eligibility Failed (Phase 2 — not_shortlisted):')
  for (const a of allApps.filter(x => x.status === 'not_shortlisted')) {
    const reason = (a.rejection_reason ?? '').slice(0, 70)
    console.log(`      ${a.user.full_name.padEnd(26)} ${reason}...`)
  }

  console.log(`\n  ─── Totals ────────────────────────────────────────────────────────────`)
  console.log(`  Total applications     : ${allApps.length}`)
  console.log(`  Anomaly flagged        : ${allApps.filter(a => a.status === 'anomaly_flagged').length}`)
  console.log(`  Not shortlisted        : ${allApps.filter(a => a.status === 'not_shortlisted').length}`)
  console.log(`  Verification complete  : ${allApps.filter(a => a.status === 'verification_complete').length}`)
  console.log(`  Verification pending   : ${allApps.filter(a => a.status === 'verification_pending').length}`)

  console.log(`\n  Login credentials (password: Demo@1234)`)
  console.log(`  ${'─'.repeat(60)}`)
  for (const s of STUDENTS.slice(0, 15)) {
    console.log(`    ${s.user.full_name.padEnd(26)} ${s.user.email}`)
  }
  console.log(`  --- Anomaly rejected ---`)
  for (const s of STUDENTS.slice(15, 22)) {
    console.log(`    ${s.user.full_name.padEnd(26)} ${s.user.email}`)
  }
  console.log(`  --- Eligibility failed ---`)
  for (const s of STUDENTS.slice(22)) {
    console.log(`    ${s.user.full_name.padEnd(26)} ${s.user.email}`)
  }

  console.log('\n  Admin: admin@scholarship.org  |  pass: Admin@1234')
  console.log('  App:   http://localhost:3000')
  console.log('\n' + hr() + '\n')
}

main()
  .catch(e => { console.error('\n   Fatal:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
