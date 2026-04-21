/**
 * 20-Application Staged Seeder
 * 
 * Creates 20 student applications at specific pipeline stages for demo:
 *   - 10 shortlisted      (passed Phase 1 + Phase 2 eligibility, awaiting scoring)
 *   - 5  verification_pending  (scored, assigned to verifier, not yet visited)
 *   - 3  approved          (full pipeline complete, approved)
 *   - 1  rejected          (scoring pipeline complete, rejected)
 *   - 1  anomaly_flagged   (Phase 1 fraud detection fired)
 *
 * Run from apps/api/:
 *   npx tsx src/scripts/seed20Applications.ts
 */

import * as path   from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import * as bcrypt   from 'bcryptjs'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

//  Student profile type 
interface StudentProfile {
  user:     { email: string; full_name: string; phone: string }
  personal: {
    date_of_birth: Date; gender: string
    caste_category: 'SC'|'ST'|'OBC'|'General'
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
    active_arrears: number; institution_code: string
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
  // Seeder control fields
  _stage: 'shortlisted' | 'verification_pending' | 'approved' | 'rejected' | 'anomaly_flagged'
  _score?: { merit: number; need: number; integrity: number; composite: number }
}

//  20 Student Profiles 

const STUDENTS: StudentProfile[] = [

  // 
  //  SHORTLISTED (110): awaiting Phase 3 scoring
  // 

  // 1  Priya Sharma: SC orphan, BPL, kuccha
  {
    _stage: 'shortlisted',
    user: { email: 'priya.sharma@demo.sc', full_name: 'Priya Sharma', phone: '9200000001' },
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

  // 2  Murugan Selvam: ST tribal AAY, kuccha, 7-member
  {
    _stage: 'shortlisted',
    user: { email: 'murugan.selvam@demo.sc', full_name: 'Murugan Selvam', phone: '9200000002' },
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

  // 3  Lakshmi Devi: SC differently-abled, single parent, BPL
  {
    _stage: 'shortlisted',
    user: { email: 'lakshmi.devi@demo.sc', full_name: 'Lakshmi Devi', phone: '9200000003' },
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

  // 4  Anbarasan Raj: ST tribal orphan, 82% HSC
  {
    _stage: 'shortlisted',
    user: { email: 'anbarasan.raj@demo.sc', full_name: 'Anbarasan Raj', phone: '9200000004' },
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
    financial: { total_annual_income: 60000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 5000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 8000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 3000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 1, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 5  Kavitha Rajan: SC widow mother, rural, semi-pucca, income 1L
  {
    _stage: 'shortlisted',
    user: { email: 'kavitha.rajan@demo.sc', full_name: 'Kavitha Rajan', phone: '9200000005' },
    personal: {
      date_of_birth: new Date('2003-02-18'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'alive',
      is_single_parent: true, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Cuddalore', pincode: '607001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 76.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 71.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.Sc. Nursing',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 3, earning_members: 1, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: true },
    financial: { total_annual_income: 100000, ration_card_type: 'BPL', loan_outstanding: 15000, gold_value_inr: 8000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 20000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 5000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: true },
  },

  // 6  Selvakumar Pandi: OBC, rural, income 1.2L, semi-pucca, first-gen
  {
    _stage: 'shortlisted',
    user: { email: 'selvakumar.pandi@demo.sc', full_name: 'Selvakumar Pandi', phone: '9200000006' },
    personal: {
      date_of_birth: new Date('2002-09-25'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Pudukottai', pincode: '622001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 80.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 74.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Electronics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 6, earning_members: 1, dependents: 5, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 120000, ration_card_type: 'BPL', loan_outstanding: 30000, gold_value_inr: 20000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 30000, land_area_acres: 0.5, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 10000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 7  Nalini Murugesan: SC minority, rural, kuccha, income 80K
  {
    _stage: 'shortlisted',
    user: { email: 'nalini.murugesan@demo.sc', full_name: 'Nalini Murugesan', phone: '9200000007' },
    personal: {
      date_of_birth: new Date('2003-06-12'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: true,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Kanyakumari', pincode: '629001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 74.5, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: 69.0, current_year_of_study: 2,
      course_type: 'UG', course_name: 'B.A. English Literature',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: true, mother_widow_pension: false },
    financial: { total_annual_income: 80000, ration_card_type: 'AAY', loan_outstanding: 10000, gold_value_inr: 8000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 15000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 4000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: true, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 8  Ravi Krishnaswamy: OBC, rural, semi-pucca, income 1.5L, 5 sibs
  {
    _stage: 'shortlisted',
    user: { email: 'ravi.krishnaswamy@demo.sc', full_name: 'Ravi Krishnaswamy', phone: '9200000008' },
    personal: {
      date_of_birth: new Date('2003-11-03'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Nagapattinam', pincode: '611001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 77.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.Sc. Physics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 8, earning_members: 1, dependents: 7, siblings_in_education: 3, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 150000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 12000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 22000, land_area_acres: 1.0, owns_land: true, vehicle_count: 1, car_value: 0, electronics_value: 7000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 9  Tamilselvi Arumugam: SC, chronic illness family, pucca rented, income 1.8L
  {
    _stage: 'shortlisted',
    user: { email: 'tamilselvi.arumugam@demo.sc', full_name: 'Tamilselvi Arumugam', phone: '9200000009' },
    personal: {
      date_of_birth: new Date('2002-07-22'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Thanjavur', pincode: '613001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 79.5, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 73.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Chemistry',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: true, mother_widow_pension: false },
    financial: { total_annual_income: 180000, ration_card_type: 'BPL', loan_outstanding: 25000, gold_value_inr: 18000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 35000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 9000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 10  Karthik Venkatesh: OBC, semi-urban, semi-pucca, income 1.6L
  {
    _stage: 'shortlisted',
    user: { email: 'karthik.venkatesh@demo.sc', full_name: 'Karthik Venkatesh', phone: '9200000010' },
    personal: {
      date_of_birth: new Date('2003-03-15'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: false,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Tirupur', pincode: '641601',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 71.0, hsc_board: 'TN Board', hsc_year: 2022,
      ug_aggregate_pct: null, current_year_of_study: 1,
      course_type: 'UG', course_name: 'B.Com General',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 2, dependents: 3, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 160000, ration_card_type: 'BPL', loan_outstanding: 20000, gold_value_inr: 15000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 28000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 12000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 
  //  VERIFICATION PENDING (1115): scored, verifier assigned, not yet visited
  // 

  // 11  Deepa Sundaram: OBC, urban, income 2.2L
  {
    _stage: 'verification_pending',
    _score: { merit: 42.0, need: 68.5, integrity: 0, composite: 0.72 },
    user: { email: 'deepa.sundaram@demo.sc', full_name: 'Deepa Sundaram', phone: '9200000011' },
    personal: {
      date_of_birth: new Date('2002-08-25'), gender: 'Female',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Coimbatore', pincode: '641001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 72.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 66.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Computer Science',
      study_mode: 'full_time', active_arrears: 1,
      institution_code: 'PSG_TECH',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 220000, ration_card_type: 'BPL', loan_outstanding: 40000, gold_value_inr: 25000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 60000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 18000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 12  Vijayakumar Natarajan: SC, rural, semi-pucca, income 1.9L
  {
    _stage: 'verification_pending',
    _score: { merit: 38.5, need: 74.0, integrity: 0, composite: 0.78 },
    user: { email: 'vijayakumar.natarajan@demo.sc', full_name: 'Vijayakumar Natarajan', phone: '9200000012' },
    personal: {
      date_of_birth: new Date('2001-05-16'), gender: 'Male',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Salem', pincode: '636001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 68.5, hsc_board: 'TN Board', hsc_year: 2020,
      ug_aggregate_pct: 63.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.Tech Information Technology',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 5, earning_members: 1, dependents: 4, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 190000, ration_card_type: 'BPL', loan_outstanding: 50000, gold_value_inr: 20000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 45000, land_area_acres: 0.5, owns_land: true, vehicle_count: 1, car_value: 0, electronics_value: 12000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 13  Anitha Subramanian: OBC, semi-urban, pucca rented, income 2.5L
  {
    _stage: 'verification_pending',
    _score: { merit: 35.0, need: 61.0, integrity: 0, composite: 0.65 },
    user: { email: 'anitha.subramanian@demo.sc', full_name: 'Anitha Subramanian', phone: '9200000013' },
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
      hsc_percentage: 65.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 60.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Mathematics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 2, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 250000, ration_card_type: 'OPH', loan_outstanding: 60000, gold_value_inr: 30000, fixed_deposit_amount: 10000 },
    assets: { total_asset_value: 80000, land_area_acres: 0, owns_land: false, vehicle_count: 1, car_value: 0, electronics_value: 22000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: false, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: false },
  },

  // 14  Suresh Palani: OBC, rural, semi-pucca, income 2L
  {
    _stage: 'verification_pending',
    _score: { merit: 40.0, need: 70.0, integrity: 0, composite: 0.74 },
    user: { email: 'suresh.palani@demo.sc', full_name: 'Suresh Palani', phone: '9200000014' },
    personal: {
      date_of_birth: new Date('2001-12-28'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Erode', pincode: '638001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 74.0, hsc_board: 'TN Board', hsc_year: 2020,
      ug_aggregate_pct: 68.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.Sc. Agriculture',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 6, earning_members: 2, dependents: 4, siblings_in_education: 2, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 200000, ration_card_type: 'BPL', loan_outstanding: 35000, gold_value_inr: 20000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 50000, land_area_acres: 1.0, owns_land: true, vehicle_count: 1, car_value: 0, electronics_value: 15000 },
    housing: { house_type: 'semi_pucca', ownership_type: 'owned', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 15  Meenakshi Durai: SC, urban, kuccha, income 1.4L
  {
    _stage: 'verification_pending',
    _score: { merit: 44.0, need: 72.0, integrity: 0, composite: 0.82 },
    user: { email: 'meenakshi.durai@demo.sc', full_name: 'Meenakshi Durai', phone: '9200000015' },
    personal: {
      date_of_birth: new Date('2002-04-05'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'urban', state: 'Tamil Nadu', district: 'Chennai', pincode: '600001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 81.0, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 75.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.E. Computer Science',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 4, earning_members: 1, dependents: 3, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 140000, ration_card_type: 'BPL', loan_outstanding: 20000, gold_value_inr: 10000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 18000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 8000 },
    housing: { house_type: 'kuccha', ownership_type: 'govt_allotted', total_rooms: 1, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: true, has_pm_schemes: true },
  },

  // 
  //  APPROVED (1618): full pipeline complete
  // 

  // 16  Rajesh Kumar: ST, tribal, orphan, full pipeline approved
  {
    _stage: 'approved',
    _score: { merit: 48.0, need: 80.0, integrity: 0, composite: 0.91 },
    user: { email: 'rajesh.kumar@demo.sc', full_name: 'Rajesh Kumar', phone: '9200000016' },
    personal: {
      date_of_birth: new Date('2001-06-20'), gender: 'Male',
      caste_category: 'ST', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'deceased',
      is_single_parent: false, is_orphan: true,
      guardian_name: 'Uncle Ramesh', guardian_annual_income: 50000,
      residential_type: 'tribal', state: 'Tamil Nadu', district: 'Dindigul', pincode: '624001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 88.0, hsc_board: 'TN Board', hsc_year: 2020,
      ug_aggregate_pct: 81.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.E. Mechanical',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 3, earning_members: 1, dependents: 2, siblings_in_education: 1, has_chronic_illness: false, mother_widow_pension: false },
    financial: { total_annual_income: 50000, ration_card_type: 'AAY', loan_outstanding: 0, gold_value_inr: 3000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 8000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 3000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 1, has_electricity: false, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: false, has_aay_card: true, has_mgnrega: true, has_ayushman: true, has_pm_schemes: true },
  },

  // 17  Susheela Bai: SC differently-abled, widow mother, BPL, approved
  {
    _stage: 'approved',
    _score: { merit: 44.5, need: 78.0, integrity: 0, composite: 0.87 },
    user: { email: 'susheela.bai@demo.sc', full_name: 'Susheela Bai', phone: '9200000017' },
    personal: {
      date_of_birth: new Date('2002-03-08'), gender: 'Female',
      caste_category: 'SC', religion_minority_status: false,
      is_differently_abled: true, is_first_graduate: true,
      father_status: 'deceased', mother_status: 'alive',
      is_single_parent: true, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Thoothukudi', pincode: '628001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 80.5, hsc_board: 'TN Board', hsc_year: 2021,
      ug_aggregate_pct: 75.0, current_year_of_study: 3,
      course_type: 'UG', course_name: 'B.Sc. Biotechnology',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'GOVT_ARTS_CBE',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 3, earning_members: 1, dependents: 2, siblings_in_education: 0, has_chronic_illness: false, mother_widow_pension: true },
    financial: { total_annual_income: 85000, ration_card_type: 'BPL', loan_outstanding: 15000, gold_value_inr: 8000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 15000, land_area_acres: 0, owns_land: false, vehicle_count: 0, car_value: 0, electronics_value: 5000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 1, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 18  Manikandan Pillai: OBC, rural, BPL, kuccha, chronic illness
  {
    _stage: 'approved',
    _score: { merit: 40.0, need: 75.0, integrity: 0, composite: 0.83 },
    user: { email: 'manikandan.pillai@demo.sc', full_name: 'Manikandan Pillai', phone: '9200000018' },
    personal: {
      date_of_birth: new Date('2001-09-14'), gender: 'Male',
      caste_category: 'OBC', religion_minority_status: false,
      is_differently_abled: false, is_first_graduate: true,
      father_status: 'alive', mother_status: 'alive',
      is_single_parent: false, is_orphan: false,
      residential_type: 'rural', state: 'Tamil Nadu', district: 'Virudhunagar', pincode: '626001',
      enrollment_status: 'active',
    },
    academic: {
      hsc_percentage: 75.0, hsc_board: 'TN Board', hsc_year: 2020,
      ug_aggregate_pct: 70.0, current_year_of_study: 4,
      course_type: 'UG', course_name: 'B.E. Electronics',
      study_mode: 'full_time', active_arrears: 0,
      institution_code: 'ANNA_UNIV',
      receiving_other_scholarship: false, prev_awarded_by_trust: false,
    },
    family: { family_size: 6, earning_members: 1, dependents: 5, siblings_in_education: 2, has_chronic_illness: true, mother_widow_pension: false },
    financial: { total_annual_income: 110000, ration_card_type: 'BPL', loan_outstanding: 20000, gold_value_inr: 10000, fixed_deposit_amount: 0 },
    assets: { total_asset_value: 20000, land_area_acres: 0.5, owns_land: true, vehicle_count: 0, car_value: 0, electronics_value: 6000 },
    housing: { house_type: 'kuccha', ownership_type: 'owned', total_rooms: 2, has_electricity: true, has_piped_water: false, has_toilet: false, has_lpg: false },
    benefits: { has_active_benefits: true, has_bpl_card: true, has_aay_card: false, has_mgnrega: true, has_ayushman: true, has_pm_schemes: false },
  },

  // 
  //  REJECTED (19): below cutoff after full pipeline
  // 

  // 19  Preethi Iyer: General, urban, high income, flat, rejected
  {
    _stage: 'rejected',
    _score: { merit: 38.0, need: 20.0, integrity: -8, composite: 0.22 },
    user: { email: 'preethi.iyer@demo.sc', full_name: 'Preethi Iyer', phone: '9200000019' },
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
      hsc_percentage: 82.0, hsc_board: 'CBSE', hsc_year: 2020,
      ug_aggregate_pct: 72.0, current_year_of_study: 4,
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

  // 
  //  ANOMALY FLAGGED (20): Phase 1 fraud detection
  // 

  // 20  Vijay Ramachandran: G-01 + G-04  low income but luxury car + FD
  {
    _stage: 'anomaly_flagged',
    user: { email: 'vijay.ramachandran@demo.sc', full_name: 'Vijay Ramachandran', phone: '9200000020' },
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
    financial: { total_annual_income: 150000, ration_card_type: 'BPL', loan_outstanding: 0, gold_value_inr: 250000, fixed_deposit_amount: 120000 },
    assets: { total_asset_value: 600000, land_area_acres: 0, owns_land: false, vehicle_count: 2, car_value: 350000, electronics_value: 80000 },
    housing: { house_type: 'pucca_rented', ownership_type: 'rented', total_rooms: 3, has_electricity: true, has_piped_water: true, has_toilet: true, has_lpg: true },
    benefits: { has_active_benefits: false, has_bpl_card: true, has_aay_card: false, has_mgnrega: false, has_ayushman: false, has_pm_schemes: false },
  },
]

//  Main 
async function main() {
  console.log('\n')
  console.log('  SCHOLARSHIP PLATFORM  20-APPLICATION STAGED SEEDER')
  console.log('  10 shortlisted  5 verification_pending  3 approved  1 rejected  1 anomaly')
  console.log('\n')

  //  Step 1: Wipe existing student data 
  console.log('[1/4] Wiping existing student data...')
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
  console.log('   Wiped all student users, profiles, and applications\n')

  //  Step 2: Load dependencies 
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { console.error('   No active program found. Run: npm run db:seed\n'); process.exit(1) }

  const institutions = await prisma.institution.findMany()
  const instMap = new Map(institutions.map(i => [i.code, i.id]))

  const verifier = await prisma.user.findFirst({ where: { role: 'verifier' } })
  if (!verifier) { console.error('   No verifier user found. Run: npm run db:seed\n'); process.exit(1) }

  const admin = await prisma.user.findFirst({ where: { role: 'super_admin' } })

  const passwordHash = await bcrypt.hash('Demo@1234', 12)
  console.log(`  Program  : ${program.program_name}`)
  console.log(`  Verifier : ${verifier.full_name}\n`)

  //  Step 3: Create users, profiles, and set application statuses 
  console.log('[2/4] Creating users + profiles...')
  const results: { name: string; stage: string; appId: string }[] = []

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

    // Determine application status + scores
    const isAnomaly = s._stage === 'anomaly_flagged'
    const appStatus = isAnomaly ? 'anomaly_flagged' : s._stage === 'shortlisted' ? 'shortlisted' : s._stage === 'verification_pending' ? 'verification_pending' : s._stage === 'approved' ? 'approved' : 'rejected'

    const appData: Prisma.ApplicationUncheckedCreateInput = {
      program_id:   program.id,
      user_id:      user.id,
      status:       appStatus,
      submitted_at: new Date(Date.now() - Math.random() * 7 * 86400000), // within last 7 days
      anomaly_flag: isAnomaly,
      anomaly_score: isAnomaly ? 0.82 : 0.12,
      anomaly_reasons: isAnomaly
        ? ({ g_rules_fired: ['G-01', 'G-03', 'G-04'], ml_flag: true } as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    }

    if (s._score) {
      appData.merit_score     = s._score.merit
      appData.rule_need_score = s._score.need
      appData.integrity_adj   = s._score.integrity
      appData.composite_score = s._score.composite
      appData.scored_at       = new Date()
    }

    if (s._stage === 'approved') {
      appData.final_decision = 'approved'
      appData.decided_at     = new Date()
      appData.decided_by_id  = admin?.id ?? null
      appData.post_verify_composite = (s._score?.composite ?? 0.8) * 1.0
    }

    if (s._stage === 'rejected') {
      appData.final_decision    = 'rejected'
      appData.decided_at        = new Date()
      appData.decided_by_id     = admin?.id ?? null
      appData.rejection_reason  = 'Composite score below selection cutoff after full pipeline evaluation.'
      appData.post_verify_composite = (s._score?.composite ?? 0.5) * 0.85
    }

    const app = await prisma.application.upsert({
      where:  { program_id_user_id: { program_id: program.id, user_id: user.id } },
      update: appData as Prisma.ApplicationUncheckedUpdateInput,
      create: appData,
    })

    results.push({ name: s.user.full_name, stage: s._stage, appId: app.id })
    process.stdout.write('.')
  }
  console.log(`\n   Created ${STUDENTS.length} applications\n`)

  //  Step 4: Create verification assignments for verification_pending apps 
  console.log('[3/4] Creating verifier assignments for verification_pending apps...')
  for (const r of results.filter(r => r.stage === 'verification_pending')) {
    await prisma.verificationAssignment.upsert({
      where:  { application_id: r.appId },
      update: { verifier_id: verifier.id, assigned_at: new Date(), status: 'pending' },
      create: { application_id: r.appId, verifier_id: verifier.id, assigned_at: new Date(), status: 'pending' },
    })
    console.log(`   Assigned verifier  ${r.name}`)
  }

  // Create completed assignments + field reports for approved/rejected
  console.log('\n[4/4] Creating completed verification records for approved/rejected apps...')
  for (const r of results.filter(r => r.stage === 'approved' || r.stage === 'rejected')) {
    const matchScore = r.stage === 'approved' ? 88 : 55
    const assignment = await prisma.verificationAssignment.upsert({
      where:  { application_id: r.appId },
      update: { verifier_id: verifier.id, assigned_at: new Date(), status: 'complete' },
      create: { application_id: r.appId, verifier_id: verifier.id, assigned_at: new Date(), status: 'complete' },
    })
    await prisma.verifierFieldReport.create({
      data: {
        assignment_id:                assignment.id,
        verifier_id:                  verifier.id,
        match_score:                  matchScore,
        gps_latitude:                 11.1271,
        gps_longitude:                78.6569,
        submitted_at:                 new Date(),
        verifier_notes:               r.stage === 'approved' ? 'All declarations verified on-site.' : 'Several inconsistencies found.',
        sec_a_identity_match:         true,
        sec_b_housing_type_confirmed: null,
        sec_c_electricity:            r.stage === 'approved',
        sec_c_water:                  r.stage === 'approved',
        sec_c_toilet:                 r.stage === 'approved',
        sec_c_lpg:                    false,
        sec_d_income_doc_present:     r.stage === 'approved',
        sec_d_occupation_matches:     r.stage === 'approved',
        sec_e_car_present:            false,
        sec_e_gold_visible:           false,
        sec_f_electronics_present:    false,
        sec_g_land_present:           false,
        sec_h_fd_docs_visible:        false,
        sec_h_savings_visible:        false,
        sec_i_all_docs_present:       r.stage === 'approved',
        yes_count:                    r.stage === 'approved' ? 9 : 5,
        total_fields:                 10,
      },
    })
    console.log(`   Verification complete  ${r.name} (match: ${matchScore}%)`)
  }

  //  Summary 
  console.log('\n')
  console.log('  SEEDER COMPLETE')
  console.log('')
  console.log(`\n  Stage breakdown:`)
  const stageMap: Record<string, number> = {}
  for (const r of results) { stageMap[r.stage] = (stageMap[r.stage] || 0) + 1 }
  for (const [stage, count] of Object.entries(stageMap)) {
    console.log(`    ${stage.padEnd(22)} : ${count}`)
  }
  console.log(`\n  Total    : ${results.length} applications`)
  console.log(`  Verifier : ${verifier.full_name} (${verifier.email})`)
  console.log(`\n  Login credentials (password: Demo@1234)`)
  console.log(`  `)
  for (const s of STUDENTS) {
    const icon = s._stage === 'approved' ? '' : s._stage === 'rejected' ? '' : s._stage === 'anomaly_flagged' ? '' : ''
    console.log(`  ${icon} ${s.user.full_name.padEnd(28)} ${s.user.email}`)
  }
  console.log(`\n  Admin : admin@scholarship.org  |  pass: Admin@1234`)
  console.log(`  App   : http://localhost:3000\n`)
}

main()
  .catch(e => { console.error('\n   Seeder failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
