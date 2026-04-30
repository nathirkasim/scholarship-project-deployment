/**
 * Full-Pipeline Seeder  25 Diverse Student Profiles
 * 
 * Wipes all existing student/application data, creates 25 fresh profiles,
 * runs the complete 3-phase pipeline, simulates field verification, and
 * makes final decisions so exactly 10 are APPROVED and 15 are REJECTED.
 *
 * Pipeline steps executed:
 *   1  Wipe: delete all applications, student profiles, student users
 *   2  Create 25 users + 7-table profiles + applications
 *   3  Phase 1  Anomaly pre-filter (G-01..G-07 + Isolation Forest)
 *   4  Phase 3  Rule engine scoring (Domains AF + integrity)
 *   5  TOPSIS batch ranking (replaces provisional WSM composite)
 *   6  Verification simulation (realistic match scores per profile)
 *   7  Verification multiplier (I-02/I-03/I-04)
 *   8  Final decisions: top 10  approved, 11-25  rejected
 *
 * Run from apps/api/:
 *   npx tsx src/scripts/seed25Applications.ts
 *
 * Prerequisites:
 *   - Docker containers running (db, redis, ml-service)
 *   - DATABASE_URL set (loaded from root /.env)
 */

import * as path   from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import * as bcrypt   from 'bcryptjs'
import { PrismaClient, Prisma } from '@prisma/client'
import { runAnomalyPreFilter }        from '../services/anomaly/anomalyPreFilter'
import { runTOPSIS, applyVerificationMultiplier } from '../services/scoring/ruleEngine'

const prisma = new PrismaClient()

//  Institution codes present in the main seed 
type InstCode = 'ANNA_UNIV' | 'IIT_MADRAS' | 'PSG_TECH' | 'GOVT_ARTS_CBE' | 'NIT_TRICHY'

//  Student profile type (mirrors DB tables) 
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

//  25 Student Profiles 
// Profiles 1-10:  HIGH composite  designed to be APPROVED
// Profiles 11-25: LOW composite   designed to be REJECTED

const STUDENTS: StudentProfile[] = [

  // 
  //  APPROVED COHORT (110): Low income, high vulnerability, good merit
  // 

  // 1  Priya Sharma: SC orphan, BPL, kuccha, no utilities, engineering 85%
  {
    user: { email: 'priya.sharma@demo.sc', full_name: 'Priya Sharma', phone: '9100000001' },
    personal: {
      date_of_birth: new Date('2003-05-14'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'deceased',
      is_single_parent: false, is_orphan: true,
      guardian_name: 'Kamala Devi', guardian_annual_income: 60000,
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

  // 2  Murugan Selvam: ST tribal AAY, kuccha, 7-member family, chronic illness, 73%
  {
    user: { email: 'murugan.selvam@demo.sc', full_name: 'Murugan Selvam', phone: '9100000002' },
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
    assets: { total_asset_value: 12000, land_area_acres: 0.5, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 3000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 1, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: true, has_mgnrega: true, has_ayushman: true, has_pm_schemes: true },
  },

  // 3  Lakshmi Devi: SC, differently-abled, single parent (father deceased), BPL, 78%
  {
    user: { email: 'lakshmi.devi@demo.sc', full_name: 'Lakshmi Devi', phone: '9100000003' },
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

  // 4  Anbarasan Raj: ST tribal orphan, first-gen, 82% HSC, income 60K
  {
    user: { email: 'anbarasan.raj@demo.sc', full_name: 'Anbarasan Raj', phone: '9100000004' },
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

  // 5  Fatima Begum: Muslim minority + SC, BPL, kuccha, income 80K, 80%
  {
    user: { email: 'fatima.begum@demo.sc', full_name: 'Fatima Begum', phone: '9100000005' },
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

  // 6  Valli Kannan: SC, widow pension, BPL+MGNREGA, single parent, kuccha, 80%
  {
    user: { email: 'valli.kannan@demo.sc', full_name: 'Valli Kannan', phone: '9100000006' },
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

  // 7  Selvi Arumugam: ST tribal AAY+MGNREGA, no utilities, 7-member family, 74%
  {
    user: { email: 'selvi.arumugam@demo.sc', full_name: 'Selvi Arumugam', phone: '9100000007' },
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
      course_type: 'UG', course_name: 'B.Com Accounting',
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

  // 8  Ramesh Babu: SC, BPL, first-gen orphan, income 1.5L, semi-pucca, 79%
  {
    user: { email: 'ramesh.babu@demo.sc', full_name: 'Ramesh Babu', phone: '9100000008' },
    personal: {
      date_of_birth: new Date('2002-09-15'), gender: 'Male',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'deceased',
      is_single_parent: false, is_orphan: true,
      guardian_name: 'Uncle Suresh', guardian_annual_income: 80000,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Madurai', pincode: '625001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 79.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 71.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Electronics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 150000, ration_card_type: 'BPL', loan_outstanding: 30000, gold_value_inr: 12000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 30000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 15000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 9  Pushpa Nair: OBC, rural, single parent widow, BPL, kuccha rented, 77%
  {
    user: { email: 'pushpa.nair@demo.sc', full_name: 'Pushpa Nair', phone: '9100000009' },
    personal: {
      date_of_birth: new Date('2003-11-02'), gender: 'Female',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'alive',
      is_single_parent: true, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Thanjavur', pincode: '613001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 77.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 70.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.Sc. Chemistry',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: true },
    financial: { total_annual_income: 180000, ration_card_type: 'BPL', loan_outstanding: 40000, gold_value_inr: 18000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 35000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 10000 },
    housing: { house_type: 'kuccha', ownership_type: 'rented', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 10  Durai Pandian: ST tribal AAY+MGNREGA+PM, income 60K, 7-member, 69%
  {
    user: { email: 'durai.pandian@demo.sc', full_name: 'Durai Pandian', phone: '9100000010' },
    personal: {
      date_of_birth: new Date('2004-06-14'), gender: 'Male',
      caste_category: 'ST', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'tribal', state: 'Tamil Nadu', district: 'Krishnagiri', pincode: '635001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 69.0, hsc_board: 'TN Board', hsc_year: 2023,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.A. Economics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 7, earning_members: 1, dependents: 6, siblings_in_education: 3, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 60000, ration_card_type: 'AAY', loan_outstanding: 0, gold_value_inr: 4000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 8000, land_area_acres: 0.4, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 2000 },
    housing: { house_type: 'kuccha', ownership_type: 'govt_allotted', total_rooms: 1, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: true, has_mgnrega: true, has_ayushman: true, has_pm_schemes: true },
  },

  // 
  //  REJECTED COHORT (1125): Higher income, better housing, lower vulnerability
  // 

  // 11  Karthik Srinivasan: General, urban, income 5L, pucca owned, 74%
  {
    user: { email: 'karthik.srinivasan@demo.sc', full_name: 'Karthik Srinivasan', phone: '9100000011' },
    personal: {
      date_of_birth: new Date('2002-03-10'), gender: 'Male',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 74.0, hsc_board: 'CBSE', hsc_year: 2021,
      ug_aggregate_pct: 68.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.B.A.',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 500000, ration_card_type: 'none', loan_outstanding: 100000, gold_value_inr: 80000, fixed_deposit_amount: 50000 },
    assets: { total_asset_value: 350000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 50000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 12  Deepa Sundaram: OBC, urban, income 3.5L, semi-pucca, 65%
  {
    user: { email: 'deepa.sundaram@demo.sc', full_name: 'Deepa Sundaram', phone: '9100000012' },
    personal: {
      date_of_birth: new Date('2002-08-25'), gender: 'Female',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Coimbatore', pincode: '641001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 65.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 61.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Computer Science',
      study_mode: 'full_time', active_arrears: 1,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 350000, ration_card_type: 'none', loan_outstanding: 60000, gold_value_inr: 60000, fixed_deposit_amount: 30000 },
    assets: { total_asset_value: 200000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 40000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 13  Vijay Ramachandran: General, urban, income 7L, flat, 80%, Ayushman only
  {
    user: { email: 'vijay.ramachandran@demo.sc', full_name: 'Vijay Ramachandran', phone: '9100000013' },
    personal: {
      date_of_birth: new Date('2001-05-16'), gender: 'Male',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600020',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 80.0, hsc_board: 'CBSE', hsc_year: 2020,
      ug_aggregate_pct: 74.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.Tech Information Technology',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'PSG_TECH',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 700000, ration_card_type: 'none', loan_outstanding: 150000, gold_value_inr: 120000, fixed_deposit_amount: 100000 },
    assets: { total_asset_value: 600000, land_area_acres: 0, owns_land: false, vehicle_count: 2, car_value: 200000, electronics_value: 80000 },
    housing: { house_type: 'flat_apartment', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 14  Anitha Mohan: OBC, semi-urban, income 4L, pucca rented, 70%
  {
    user: { email: 'anitha.mohan@demo.sc', full_name: 'Anitha Mohan', phone: '9100000014' },
    personal: {
      date_of_birth: new Date('2002-10-11'), gender: 'Female',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Trichy', pincode: '620001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 70.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 65.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Mathematics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 400000, ration_card_type: 'none', loan_outstanding: 80000, gold_value_inr: 70000, fixed_deposit_amount: 20000 },
    assets: { total_asset_value: 250000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 45000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 15  Suresh Narayanan: General, rural, income 6L, pucca owned, 2 acres, 72%
  {
    user: { email: 'suresh.narayanan@demo.sc', full_name: 'Suresh Narayanan', phone: '9100000015' },
    personal: {
      date_of_birth: new Date('2001-12-28'), gender: 'Male',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Erode', pincode: '638001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 72.0, hsc_board: 'TN Board', hsc_year: 2020,
      ug_aggregate_pct: 67.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.Sc. Agriculture',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 2, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 600000, ration_card_type: 'none', loan_outstanding: 200000, gold_value_inr: 100000, fixed_deposit_amount: 80000 },
    assets: { total_asset_value: 800000, land_area_acres: 2.0, owns_land: true, vehicle_count: 2, car_value: 150000, electronics_value: 60000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 4, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 16  Manoj Kumar: OBC, urban, income 4.5L, pucca owned, 68%, 1 arrear
  {
    user: { email: 'manoj.kumar@demo.sc', full_name: 'Manoj Kumar', phone: '9100000016' },
    personal: {
      date_of_birth: new Date('2002-07-19'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600042',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 68.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 62.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Mechanical',
      study_mode: 'full_time', active_arrears: 1,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 450000, ration_card_type: 'none', loan_outstanding: 90000, gold_value_inr: 75000, fixed_deposit_amount: 40000 },
    assets: { total_asset_value: 280000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 55000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 17  Preethi Iyer: General, urban, income 8L, flat, 85%, 2 arrears
  {
    user: { email: 'preethi.iyer@demo.sc', full_name: 'Preethi Iyer', phone: '9100000017' },
    personal: {
      date_of_birth: new Date('2001-02-14'), gender: 'Female',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600086',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 85.0, hsc_board: 'CBSE', hsc_year: 2020,
      ug_aggregate_pct: 71.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.Tech CSE',
      study_mode: 'full_time', active_arrears: 2,
      institution_code: 'PSG_TECH',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 800000, ration_card_type: 'none', loan_outstanding: 200000, gold_value_inr: 150000, fixed_deposit_amount: 150000 },
    assets: { total_asset_value: 900000, land_area_acres: 0, owns_land: false, vehicle_count: 2, car_value: 400000, electronics_value: 100000 },
    housing: { house_type: 'flat_apartment', ownership_type: 'owned', total_rooms: 4, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 18  Senthil Nathan: OBC, semi-urban, income 3L, semi-pucca, 62%, 2 arrears
  {
    user: { email: 'senthil.nathan@demo.sc', full_name: 'Senthil Nathan', phone: '9100000018' },
    personal: {
      date_of_birth: new Date('2002-06-08'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Salem', pincode: '636002',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 62.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 58.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Physics',
      study_mode: 'full_time', active_arrears: 2,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 2, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 300000, ration_card_type: 'none', loan_outstanding: 50000, gold_value_inr: 55000, fixed_deposit_amount: 25000 },
    assets: { total_asset_value: 180000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 35000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 19  Kavitha Pillai: General, rural, income 5.5L, pucca owned, 71%
  {
    user: { email: 'kavitha.pillai@demo.sc', full_name: 'Kavitha Pillai', phone: '9100000019' },
    personal: {
      date_of_birth: new Date('2002-04-17'), gender: 'Female',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Madurai', pincode: '625002',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 71.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 66.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.A. History',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 550000, ration_card_type: 'none', loan_outstanding: 120000, gold_value_inr: 90000, fixed_deposit_amount: 60000 },
    assets: { total_asset_value: 450000, land_area_acres: 1.0, owns_land: true, vehicle_count: 1, car_value: 0, electronics_value: 50000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 4, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 20  Arun Prakash: OBC, urban, income 3.8L, pucca rented, 67%, receiving another scholarship
  {
    user: { email: 'arun.prakash@demo.sc', full_name: 'Arun Prakash', phone: '9100000020' },
    personal: {
      date_of_birth: new Date('2002-01-25'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Coimbatore', pincode: '641002',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 67.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 63.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Com Finance',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: true,  //  already has another scholarship (-10 pts A-07)
      prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 380000, ration_card_type: 'none', loan_outstanding: 70000, gold_value_inr: 65000, fixed_deposit_amount: 30000 },
    assets: { total_asset_value: 220000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 40000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 21  Nirmala Venkat: General, urban, income 6.5L, flat, 78%, previously awarded
  {
    user: { email: 'nirmala.venkat@demo.sc', full_name: 'Nirmala Venkat', phone: '9100000021' },
    personal: {
      date_of_birth: new Date('2001-09-12'), gender: 'Female',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600035',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 78.0, hsc_board: 'CBSE', hsc_year: 2020,
      ug_aggregate_pct: 72.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.Sc. Statistics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false,
      prev_awarded_by_trust: true,  //  previously awarded (-5 pts A-08)
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 650000, ration_card_type: 'none', loan_outstanding: 180000, gold_value_inr: 110000, fixed_deposit_amount: 90000 },
    assets: { total_asset_value: 700000, land_area_acres: 0, owns_land: false, vehicle_count: 2, car_value: 250000, electronics_value: 90000 },
    housing: { house_type: 'flat_apartment', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 22  Balamurugan Das: OBC, semi-urban, income 3.2L, pucca owned, 64%, 3 arrears
  {
    user: { email: 'balamurugan.das@demo.sc', full_name: 'Balamurugan Das', phone: '9100000022' },
    personal: {
      date_of_birth: new Date('2002-11-05'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Tiruppur', pincode: '641601',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 64.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 59.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Chemistry',
      study_mode: 'full_time', active_arrears: 3,  //  3 arrears (-15 pts A-03)
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 2, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 320000, ration_card_type: 'none', loan_outstanding: 60000, gold_value_inr: 55000, fixed_deposit_amount: 20000 },
    assets: { total_asset_value: 200000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 35000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 23  Saranya Gopal: General, rural, income 5L, pucca rented, 70%, 2 arrears
  {
    user: { email: 'saranya.gopal@demo.sc', full_name: 'Saranya Gopal', phone: '9100000023' },
    personal: {
      date_of_birth: new Date('2002-05-30'), gender: 'Female',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Vellore', pincode: '632002',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 70.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 64.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.A. Political Science',
      study_mode: 'full_time', active_arrears: 2,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 500000, ration_card_type: 'none', loan_outstanding: 100000, gold_value_inr: 85000, fixed_deposit_amount: 50000 },
    assets: { total_asset_value: 380000, land_area_acres: 0.5, owns_land: true, vehicle_count: 1, car_value: 0, electronics_value: 45000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 24  Dinesh Balaji: OBC, urban, income 4.2L, semi-pucca, 69%
  {
    user: { email: 'dinesh.balaji@demo.sc', full_name: 'Dinesh Balaji', phone: '9100000024' },
    personal: {
      date_of_birth: new Date('2002-02-08'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Madurai', pincode: '625003',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 69.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 64.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Com Marketing',
      study_mode: 'full_time', active_arrears: 1,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 420000, ration_card_type: 'none', loan_outstanding: 80000, gold_value_inr: 72000, fixed_deposit_amount: 35000 },
    assets: { total_asset_value: 240000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 42000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },

  // 25  Meenakshi Reddy: General, urban, income 4.8L, pucca owned, 73%
  {
    user: { email: 'meenakshi.reddy@demo.sc', full_name: 'Meenakshi Reddy', phone: '9100000025' },
    personal: {
      date_of_birth: new Date('2002-08-19'), gender: 'Female',
      caste_category: 'General', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600015',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 73.0, hsc_board: 'CBSE', hsc_year: 2021,
      ug_aggregate_pct: 68.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Biotechnology',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 480000, ration_card_type: 'none', loan_outstanding: 95000, gold_value_inr: 80000, fixed_deposit_amount: 45000 },
    assets: { total_asset_value: 320000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 48000 },
    housing: { house_type: 'pucca_owned', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },
]

//  Helpers 
const hr = (c = '', w = 76) => c.repeat(w)
const pad = (l: string, v: string | number | null, w = 34) => `  ${l.padEnd(w)} ${v ?? ''}`

//  Main 
async function main() {
  console.log('\n' + hr(''))
  console.log('  SCHOLARSHIP PLATFORM  25-APPLICATION FULL-PIPELINE SEEDER')
  console.log('  TOPSIS ranking  10 approved  15 rejected')
  console.log(hr(''))

  //  Step 1: Wipe existing student data 
  console.log('\n  [1/7] Wiping existing applications and student profiles...')
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
  console.log('   Wiped all student users, profiles, and applications')

  //  Step 2: Load dependencies 
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { console.error('\n   No active program found. Run: npm run db:seed\n'); process.exit(1) }

  const institutions = await prisma.institution.findMany()
  const instMap = new Map(institutions.map(i => [i.code, i.id]))

  const verifier = await prisma.user.findFirst({ where: { role: 'verifier' } })
  if (!verifier) { console.error('\n   No verifier user found. Run: npm run db:seed\n'); process.exit(1) }

  const passwordHash = await bcrypt.hash('Demo@1234', 12)

  console.log(`  Program   : ${program.program_name}`)
  console.log(`  Verifier  : ${verifier.full_name}`)

  //  Step 3: Create users, profiles, and applications 
  console.log('\n  [2/7] Creating 25 users, profiles, and applications...')
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
    if (!institutionId) { console.error(`   Institution not found: ${s.academic.institution_code}`); continue }
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
  console.log(`\n   Created ${applicationIds.length} applications`)

  //  Step 4: Phase 1  Anomaly pre-filter 
  console.log('\n  [3/7] Phase 1  Anomaly pre-filter (G-01..G-07 + Isolation Forest)...')
  let anomalyRejected = 0
  let passedAnomaly   = 0
  for (const appId of applicationIds) {
    try { await runAnomalyPreFilter(appId) } catch { /* ML service offline  rules still run */ }
    const a = await prisma.application.findUniqueOrThrow({ where: { id: appId } })
    if (a.anomaly_flag) anomalyRejected++
    else passedAnomaly++
  }
  console.log(`   Phase 1 complete  ${passedAnomaly} clean, ${anomalyRejected} anomaly-rejected`)

  // Rule scoring is done inside runEvaluation (called via runAnomalyPreFilter above).
  // Directly proceed to TOPSIS.

  //  Step 6: TOPSIS batch ranking
  console.log('\n  [4/7] TOPSIS batch ranking (cohort normalisation)...')
  await runTOPSIS(program.id)
  console.log('   TOPSIS composite scores computed for all scored applications')

  //  Step 7: Verification simulation 
  console.log('\n  [5/7] Simulating field verification (match scores)...')

  // Load all scored apps sorted by composite_score DESC to determine rank
  const scoredApps = await prisma.application.findMany({
    where:   { program_id: program.id, status: 'scored' },
    orderBy: { composite_score: 'desc' },
    select:  { id: true, composite_score: true, user_id: true },
  })

  for (let i = 0; i < scoredApps.length; i++) {
    const app = scoredApps[i]!
    // Top 10  85% match (1.0), others  60% match (0.85)
    const matchScore = i < 10 ? 85 : 60

    // Create verification assignment
    const assignment = await prisma.verificationAssignment.upsert({
      where:  { application_id: app.id },
      update: { verifier_id: verifier.id, assigned_at: new Date(), status: 'complete' },
      create: { application_id: app.id, verifier_id: verifier.id, assigned_at: new Date(), status: 'complete' },
    })

    // Create field report
    const isTopTen = i < 10
    await prisma.verifierFieldReport.create({
      data: {
        assignment_id:            assignment.id,
        verifier_id:              verifier.id,
        match_score:              matchScore,
        gps_latitude:             11.1271,
        gps_longitude:            78.6569,
        submitted_at:             new Date(),
        verifier_notes:           isTopTen ? 'All declarations verified and matched on-site.' : 'Partial match  some declarations differ from observed.',
        sec_a_identity_match:     true,
        sec_b_housing_type_confirmed: null,
        sec_c_electricity:        isTopTen,
        sec_c_water:              isTopTen,
        sec_c_toilet:             isTopTen,
        sec_c_lpg:                false,
        sec_d_income_doc_present: isTopTen,
        sec_d_occupation_matches: isTopTen,
        sec_e_car_present:        false,
        sec_e_gold_visible:       false,
        sec_f_electronics_present:false,
        sec_g_land_present:       false,
        sec_h_fd_docs_visible:    false,
        sec_h_savings_visible:    false,
        sec_i_all_docs_present:   isTopTen,
        yes_count:                isTopTen ? 9 : 5,
        total_fields:             10,
      },
    })
    process.stdout.write('.')
  }
  console.log(`\n   Verification simulated for ${scoredApps.length} applications`)

  //  Step 8: Apply verification multipliers 
  console.log('\n  [6/7] Applying verification multipliers (I-02/I-03/I-04)...')
  for (const app of scoredApps) {
    await applyVerificationMultiplier(app.id, program.id)
  }
  console.log('   Post-verification composites computed')

  //  Step 9: Final decisions  top 10 approved, rest rejected 
  console.log('\n  [7/7] Finalising decisions (top 10  approved, 11-25  rejected)...')

  const finalRanked = await prisma.application.findMany({
    where:   { program_id: program.id, status: 'verification_complete' },
    orderBy: { post_verify_composite: 'desc' },
    select:  { id: true, post_verify_composite: true, composite_score: true, user: { select: { full_name: true } } },
  })

  for (let i = 0; i < finalRanked.length; i++) {
    const app    = finalRanked[i]!
    const rank   = i + 1
    const decision: 'approved'|'rejected' = rank <= 10 ? 'approved' : 'rejected'

    await prisma.application.update({
      where: { id: app.id },
      data:  {
        final_decision:   decision,
        decided_at:       new Date(),
        composite_rank:   rank,
        rejection_reason: decision === 'rejected'
          ? `Ranked #${rank}  composite score below selection cutoff (top 10 selected out of ${finalRanked.length}).`
          : null,
      },
    })

    await prisma.applicationStatusLog.create({
      data: {
        application_id: app.id,
        from_status:    'verification_complete',
        to_status:      decision,
        reason:         `Final rank #${rank} | Post-verify composite: ${Number(app.post_verify_composite).toFixed(2)}`,
      },
    })
  }
  console.log(`   Decisions finalised  ${finalRanked.filter((_, i) => i < 10).length} approved, ${finalRanked.filter((_, i) => i >= 10).length} rejected`)

  //  Final Summary 
  const allApps = await prisma.application.findMany({
    where:   { program_id: program.id },
    orderBy: { composite_rank: 'asc' },
    include: { user: { select: { full_name: true } } },
  })

  console.log('\n\n' + hr(''))
  console.log('  FINAL PIPELINE RESULTS  TOPSIS COMPOSITE RANKING')
  console.log(hr(''))
  console.log('  Rk  Applicant               Merit    Need   Integ  TOPSIS  PostVerif  Decision')
  console.log('  ' + hr('-', 84))

  for (const a of allApps) {
    if (!a.composite_rank) continue
    const name    = a.user.full_name.padEnd(22)
    const merit   = a.merit_score       != null ? Number(a.merit_score).toFixed(1).padStart(6)         : '     '
    const need    = a.rule_need_score   != null ? Number(a.rule_need_score).toFixed(1).padStart(6)     : '     '
    const integ   = a.integrity_adj     != null ? Number(a.integrity_adj).toFixed(1).padStart(6)       : '     '
    const topsis  = a.composite_score   != null ? Number(a.composite_score).toFixed(2).padStart(7)     : '      '
    const postV   = a.post_verify_composite != null ? Number(a.post_verify_composite).toFixed(2).padStart(9) : '        '
    const dec     = (a.final_decision ?? a.status).padEnd(10)
    const icon    = a.final_decision === 'approved' ? '' : a.final_decision === 'rejected' ? '' : '?'
    console.log(`  ${String(a.composite_rank).padStart(2)}  ${name} ${merit}  ${need}  ${integ}  ${topsis}  ${postV}  ${icon} ${dec}`)
  }

  // Anomaly rejected
  const anomalyApps = allApps.filter(a => a.anomaly_flag && a.status === 'rejected')
  for (const a of anomalyApps) {
    console.log(`     ${a.user.full_name.padEnd(22)}  ANOMALY REJECTED in Phase 1`)
  }

  const approved   = allApps.filter(a => a.final_decision === 'approved').length
  const rejected   = allApps.filter(a => a.final_decision === 'rejected').length
  const anomalyRej = allApps.filter(a => a.anomaly_flag && !a.final_decision).length

  console.log('  ' + hr('-', 84))
  console.log(`\n  APPROVED : ${approved}`)
  console.log(`  REJECTED : ${rejected} (scoring pipeline) + ${anomalyRej} (anomaly Phase 1)`)
  console.log(`  TOTAL    : ${allApps.length}`)

  console.log(`
  Login credentials (password: Demo@1234)
  ${hr('-', 60)}`)
  for (const s of STUDENTS.slice(0, 10)) {
    console.log(`   ${s.user.full_name.padEnd(26)} ${s.user.email}`)
  }
  console.log('  ...')
  for (const s of STUDENTS.slice(10)) {
    console.log(`   ${s.user.full_name.padEnd(26)} ${s.user.email}`)
  }
  console.log('\n  Admin: admin@scholarship.org  |  pass: Admin@1234')
  console.log('  App:   http://localhost:3000')
  console.log('\n' + hr('') + '\n')
}

main()
  .catch(e => { console.error('\n   Fatal:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
