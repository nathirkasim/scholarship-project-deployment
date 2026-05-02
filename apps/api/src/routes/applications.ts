import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, isStudent } from '../middleware/auth'
import { evaluationQueue } from '../jobs'

const router = Router()

// POST /api/applications  create draft (auto-selects the single active program)
router.post('/', authenticate, isStudent, async (req, res) => {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true },
    orderBy: { created_at: 'desc' },
  })
  if (!program) { res.status(404).json({ error: 'No active scholarship program available' }); return }
  const program_id = program.id

  const existing = await prisma.application.findFirst({
    where: { program_id, user_id: req.user!.userId, status: { notIn: ['rejected', 'not_shortlisted', 'anomaly_flagged'] } },
  })
  if (existing) {
    res.status(409).json({ error: 'Application already exists for this program', application_id: existing.id })
    return
  }

  const application = await prisma.application.create({
    data: { program_id, user_id: req.user!.userId, status: 'draft' },
  })
  res.status(201).json({ application })
})

// PUT /api/applications/:id  update wizard step
router.put('/:id', authenticate, isStudent, async (req, res) => {
  const app = await prisma.application.findFirst({
    where: { id: req.params.id, user_id: req.user!.userId },
  })
  if (!app) { res.status(404).json({ error: 'Application not found' }); return }
  if (app.status !== 'draft') { res.status(400).json({ error: 'Cannot edit a submitted application' }); return }

  const { step, data } = req.body
  // Save step data to the relevant student profile table
  await saveWizardStep(req.user!.userId, step, data)
  res.json({ message: 'Step saved' })
})

// POST /api/applications/:id/submit  trigger Phase 1
router.post('/:id/submit', authenticate, isStudent, async (req, res) => {
  const app = await prisma.application.findFirst({
    where: { id: req.params.id, user_id: req.user!.userId, status: 'draft' },
    include: { program: { select: { is_active: true } } },
  })
  if (!app) { res.status(404).json({ error: 'Application not found or already submitted' }); return }

  if (!app.program.is_active) {
    res.status(400).json({ error: 'This scholarship programme is no longer accepting applications.' }); return
  }

  // Enforce mandatory document uploads before submission
  const MANDATORY = ['aadhaar', 'income_cert', 'marksheet_hsc', 'admission_proof']
  const uploaded = await prisma.document.findMany({
    where: { application_id: app.id },
    select: { doc_type: true },
  })
  const uploadedTypes = new Set(uploaded.map(d => d.doc_type))
  const missing = MANDATORY.filter(t => !uploadedTypes.has(t))
  if (missing.length > 0) {
    res.status(400).json({
      error: 'Mandatory documents are missing. Please upload all required documents before submitting.',
      missing_documents: missing,
    })
    return
  }

  const now = new Date()
  await prisma.application.update({
    where: { id: app.id },
    data: { status: 'submitted', submitted_at: now },
  })
  await prisma.applicationStatusLog.create({
    data: {
      application_id: app.id,
      from_status:    'draft',
      to_status:      'submitted',
      reason:         'Application submitted by student',
    },
  })

  await evaluationQueue.add('evaluation', { applicationId: app.id }, { priority: 1 })

  res.json({ message: 'Application submitted. Evaluation queued.', application_id: app.id })
})

// GET /api/applications/my/score-breakdown  student's own latest application score
router.get('/my/score-breakdown', authenticate, isStudent, async (req, res) => {
  const app = await prisma.application.findFirst({
    where: { user_id: req.user!.userId },
    orderBy: { created_at: 'desc' },
    select: {
      merit_score: true, rule_need_score: true,
      integrity_adj: true, composite_score: true,
      anomaly_score: true, anomaly_flag: true, anomaly_reasons: true,
      post_verify_composite: true, composite_rank: true,
      final_decision: true, status: true,
    },
  })
  if (!app) { res.status(404).json({ error: 'No application found' }); return }
  res.json({
    merit_score: app.merit_score,
    rule_need_score: app.rule_need_score,
    integrity_adj: app.integrity_adj,
    composite_score: app.composite_score,
    post_verify_composite: app.post_verify_composite,
    anomaly_flag: app.anomaly_flag,
    anomaly_score: app.anomaly_score,
    anomaly_reasons: app.anomaly_reasons,
    rank: app.composite_rank,
    final_decision: app.final_decision,
    status: app.status,
  })
})

// GET /api/applications/:id  status + scores
router.get('/:id', authenticate, async (req, res) => {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      program: { select: { program_name: true, academic_year: true } },
      documents: true,
      status_logs: { orderBy: { created_at: 'asc' } },
    },
  })

  // Students can only see their own
  if (req.user!.role === 'student' && app.user_id !== req.user!.userId) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  res.json({ application: app })
})

// GET /api/applications/:id/score-breakdown
router.get('/:id/score-breakdown', authenticate, async (req, res) => {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: req.params.id },
    select: {
      merit_score: true, rule_need_score: true,
      integrity_adj: true, composite_score: true,
      anomaly_score: true, anomaly_flag: true, anomaly_reasons: true,
      post_verify_composite: true, verification_match_score: true,
      composite_rank: true, final_decision: true, status: true,
    },
  })

  if (req.user!.role === 'student') {
    // Students see simplified breakdown
    res.json({
      merit_score: app.merit_score,
      need_score: app.rule_need_score,
      composite_score: app.composite_score,
      rank: app.composite_rank,
      status: app.status,
      final_decision: app.final_decision,
    })
    return
  }

  res.json({ breakdown: app })
})

// GET /api/applications  own applications list (student)
router.get('/', authenticate, isStudent, async (req, res) => {
  const applications = await prisma.application.findMany({
    where: { user_id: req.user!.userId },
    include: { program: { select: { program_name: true, academic_year: true } } },
    orderBy: { created_at: 'desc' },
  })
  res.json({ applications })
})

//  WIZARD STEP SAVER
async function saveWizardStep(userId: string, step: number, data: Record<string, unknown>) {
  const str  = (v: unknown) => (v != null ? String(v) : '')
  const bool = (v: unknown) => v === 'true' || v === true
  const num  = (v: unknown, fallback = 0) => v != null && v !== '' ? parseFloat(String(v)) : fallback
  const int  = (v: unknown, fallback = 0) => v != null && v !== '' ? parseInt(String(v)) : fallback

  switch (step) {
    case 1: {
      // Personal — form sends: full_name, dob, gender, phone, aadhaar_number,
      //   caste_category, religion_minority_status, enrollment_status,
      //   is_differently_abled, state, district, pincode
      const d = data as Record<string, unknown>
      if (d.phone) {
        await prisma.user.update({ where: { id: userId }, data: { phone: str(d.phone) } })
      }
      await prisma.studentPersonal.upsert({
        where:  { user_id: userId },
        update: {
          date_of_birth:            d.dob ? new Date(str(d.dob)) : undefined,
          gender:                   str(d.gender) || undefined,
          aadhaar_last4:            d.aadhaar_number ? str(d.aadhaar_number).slice(-4) : undefined,
          caste_category:           (d.caste_category as any) || undefined,
          religion_minority_status: bool(d.religion_minority_status),
          is_differently_abled:     bool(d.is_differently_abled),
          disability_type:          str(d.disability_type) || null,
          enrollment_status:        (d.enrollment_status as any) || undefined,
          state:                    str(d.state) || undefined,
          district:                 str(d.district) || undefined,
          pincode:                  str(d.pincode) || undefined,
        },
        create: {
          user_id:                  userId,
          date_of_birth:            d.dob ? new Date(str(d.dob)) : new Date('2000-01-01'),
          gender:                   str(d.gender) || 'male',
          aadhaar_last4:            d.aadhaar_number ? str(d.aadhaar_number).slice(-4) : null,
          caste_category:           (d.caste_category as any) || 'General',
          religion_minority_status: bool(d.religion_minority_status),
          is_differently_abled:     bool(d.is_differently_abled),
          disability_type:          str(d.disability_type) || null,
          enrollment_status:        (d.enrollment_status as any) || 'active',
          state:                    str(d.state) || '',
          district:                 str(d.district) || '',
          pincode:                  str(d.pincode) || '',
        },
      })
      break
    }

    case 2: {
      // Academic — form sends: institution_name, course_name, course_type, study_mode,
      //   year_of_study, hsc_percentage, ug_aggregate_pct, active_arrears,
      //   is_first_graduate, receiving_other_scholarship, prev_awarded_by_trust
      const d = data as Record<string, unknown>

      // Resolve institution: look up by name, create if not found
      let institutionId: string | null = null
      const instName = str(d.institution_name).trim()
      if (instName) {
        const found = await prisma.institution.findFirst({
          where: { name: { contains: instName, mode: 'insensitive' } },
        })
        if (found) {
          institutionId = found.id
        } else {
          const created = await prisma.institution.create({
            data: {
              name:          instName,
              code:          `INST-${Date.now()}`,
              type:          'college',
              state:         'Unknown',
              district:      'Unknown',
              is_recognized: false,
            },
          })
          institutionId = created.id
        }
      }

      // is_first_graduate lives in StudentPersonal
      await prisma.studentPersonal.upsert({
        where:  { user_id: userId },
        update: { is_first_graduate: bool(d.is_first_graduate) },
        create: {
          user_id: userId, is_first_graduate: bool(d.is_first_graduate),
          date_of_birth: new Date('2000-01-01'), gender: 'male',
          state: '', district: '', pincode: '',
        },
      })

      // Guarantee a non-null institution_id — required by schema
      const resolvedInstitutionId = institutionId ?? (
        await prisma.institution.upsert({
          where:  { code: 'PLACEHOLDER-UNSPECIFIED' },
          update: {},
          create: { name: 'Not Specified', code: 'PLACEHOLDER-UNSPECIFIED', type: 'college', state: 'Unknown', district: 'Unknown', is_recognized: false },
        })
      ).id

      const academicPayload: Record<string, unknown> = {
        course_name:                 str(d.course_name),
        course_type:                 str(d.course_type),
        study_mode:                  (d.study_mode as any) || 'full_time',
        current_year_of_study:       int(d.year_of_study, 1),
        hsc_percentage:              num(d.hsc_percentage),
        hsc_board:                   str(d.hsc_board) || null,
        hsc_year:                    d.hsc_year ? int(d.hsc_year) : null,
        ug_aggregate_pct:            d.ug_aggregate_pct !== '' ? num(d.ug_aggregate_pct) : null,
        active_arrears:              int(d.active_arrears),
        receiving_other_scholarship: bool(d.receiving_other_scholarship),
        prev_awarded_by_trust:       bool(d.prev_awarded_by_trust),
        institution_id:              resolvedInstitutionId,
      }

      await prisma.studentAcademic.upsert({
        where:  { user_id: userId },
        update: academicPayload as any,
        create: { user_id: userId, ...academicPayload } as any,
      })
      break
    }

    case 3: {
      // Family — father_status, mother_status, is_single_parent, guardian_annual_income
      // belong to StudentPersonal. The rest go to StudentFamily.
      const d = data as Record<string, unknown>

      const fatherStatus = str(d.father_status) || 'alive'
      const motherStatus = str(d.mother_status) || 'alive'
      await prisma.studentPersonal.upsert({
        where:  { user_id: userId },
        update: {
          father_status:         fatherStatus,
          mother_status:         motherStatus,
          is_single_parent:      bool(d.is_single_parent),
          is_orphan:             fatherStatus === 'deceased' && motherStatus === 'deceased',
          guardian_annual_income: d.guardian_annual_income ? num(d.guardian_annual_income) : null,
        },
        create: {
          user_id: userId, father_status: fatherStatus, mother_status: motherStatus,
          is_single_parent: bool(d.is_single_parent),
          is_orphan: fatherStatus === 'deceased' && motherStatus === 'deceased',
          guardian_annual_income: d.guardian_annual_income ? num(d.guardian_annual_income) : null,
          date_of_birth: new Date('2000-01-01'), gender: 'male', state: '', district: '', pincode: '',
        },
      })

      await prisma.studentFamily.upsert({
        where:  { user_id: userId },
        update: {
          family_size:           int(d.family_size, 1),
          earning_members:       int(d.earning_members, 1),
          dependents:            int(d.dependents),
          siblings_in_education: int(d.siblings_in_education),
          has_chronic_illness:   bool(d.has_chronic_illness),
          mother_widow_pension:  bool(d.mother_widow_pension),
        },
        create: {
          user_id:               userId,
          family_size:           int(d.family_size, 1),
          earning_members:       int(d.earning_members, 1),
          dependents:            int(d.dependents),
          siblings_in_education: int(d.siblings_in_education),
          has_chronic_illness:   bool(d.has_chronic_illness),
          mother_widow_pension:  bool(d.mother_widow_pension),
        },
      })
      break
    }

    case 4: {
      // Financial — father_occupation / mother_occupation have no schema field, discard them
      const d = data as Record<string, unknown>
      await prisma.studentFinancial.upsert({
        where:  { user_id: userId },
        update: {
          total_annual_income:  num(d.total_annual_income),
          loan_outstanding:     num(d.loan_outstanding),
          gold_value_inr:       num(d.gold_value_inr),
          fixed_deposit_amount: num(d.fixed_deposit_amount),
          ration_card_type:     (d.ration_card_type as any) || 'none',
        },
        create: {
          user_id:              userId,
          total_annual_income:  num(d.total_annual_income),
          loan_outstanding:     num(d.loan_outstanding),
          gold_value_inr:       num(d.gold_value_inr),
          fixed_deposit_amount: num(d.fixed_deposit_amount),
          ration_card_type:     (d.ration_card_type as any) || 'none',
        },
      })
      break
    }

    case 5: {
      // Assets — derive owns_land from land_area_acres
      const d = data as Record<string, unknown>
      const landAcres = num(d.land_area_acres)
      await prisma.studentAssets.upsert({
        where:  { user_id: userId },
        update: {
          total_asset_value: num(d.total_asset_value),
          car_value:         num(d.car_value),
          vehicle_count:     int(d.vehicle_count),
          electronics_value: num(d.electronics_value),
          land_area_acres:   landAcres,
          owns_land:         landAcres > 0,
          property_count:    int(d.property_count),
        },
        create: {
          user_id:           userId,
          total_asset_value: num(d.total_asset_value),
          car_value:         num(d.car_value),
          vehicle_count:     int(d.vehicle_count),
          electronics_value: num(d.electronics_value),
          land_area_acres:   landAcres,
          owns_land:         landAcres > 0,
          property_count:    int(d.property_count),
        },
      })
      break
    }

    case 6: {
      // Housing — cooking_fuel (form enum) → has_lpg (bool); residential_type → StudentPersonal
      const d = data as Record<string, unknown>
      if (d.residential_type) {
        await prisma.studentPersonal.upsert({
          where:  { user_id: userId },
          update: { residential_type: str(d.residential_type) },
          create: {
            user_id: userId, residential_type: str(d.residential_type),
            date_of_birth: new Date('2000-01-01'), gender: 'male', state: '', district: '', pincode: '',
          },
        })
      }
      await prisma.studentHousing.upsert({
        where:  { user_id: userId },
        update: {
          house_type:     (d.house_type as any) || 'pucca_owned',
          ownership_type: (d.ownership_type as any) || 'owned',
          total_rooms:    int(d.total_rooms, 2),
          has_electricity: bool(d.has_electricity ?? 'true'),
          has_piped_water: bool(d.has_piped_water ?? 'true'),
          has_toilet:     bool(d.has_toilet ?? 'true'),
          has_lpg:        d.cooking_fuel === 'lpg',
        },
        create: {
          user_id:        userId,
          house_type:     (d.house_type as any) || 'pucca_owned',
          ownership_type: (d.ownership_type as any) || 'owned',
          total_rooms:    int(d.total_rooms, 2),
          has_electricity: bool(d.has_electricity ?? 'true'),
          has_piped_water: bool(d.has_piped_water ?? 'true'),
          has_toilet:     bool(d.has_toilet ?? 'true'),
          has_lpg:        d.cooking_fuel === 'lpg',
        },
      })
      break
    }

    case 7: {
      // Benefits — remap field names, combine pm schemes, move annual_expenses to Financial
      const d = data as Record<string, unknown>

      // annual_expenses belongs to StudentFinancial
      if (d.annual_expenses != null && d.annual_expenses !== '') {
        await prisma.studentFinancial.upsert({
          where:  { user_id: userId },
          update: { annual_expenses: num(d.annual_expenses) },
          create: { user_id: userId, total_annual_income: 0, annual_expenses: num(d.annual_expenses) },
        })
      }

      // Derive has_aay_card from ration_card_type saved in step 4
      const fin = await prisma.studentFinancial.findUnique({
        where: { user_id: userId }, select: { ration_card_type: true },
      })
      const hasBpl     = bool(d.has_bpl_card) || fin?.ration_card_type === 'BPL'
      const hasAay     = fin?.ration_card_type === 'AAY'
      const hasMgnrega = bool(d.has_mgnrega)
      const hasAyushman = bool(d.has_ayushman_bharat)
      const hasPmSchemes = bool(d.has_pm_kisan) || bool(d.has_pm_awas)
      const hasAny     = hasBpl || hasAay || hasMgnrega || hasAyushman || hasPmSchemes

      await prisma.studentGovtBenefits.upsert({
        where:  { user_id: userId },
        update: {
          has_active_benefits: hasAny,
          has_bpl_card:        hasBpl,
          has_aay_card:        hasAay,
          has_mgnrega:         hasMgnrega,
          has_ayushman:        hasAyushman,
          has_pm_schemes:      hasPmSchemes,
          benefit_details:     bool(d.has_scholarship_govt) ? 'Has government scholarship' : null,
        },
        create: {
          user_id:             userId,
          has_active_benefits: hasAny,
          has_bpl_card:        hasBpl,
          has_aay_card:        hasAay,
          has_mgnrega:         hasMgnrega,
          has_ayushman:        hasAyushman,
          has_pm_schemes:      hasPmSchemes,
          benefit_details:     bool(d.has_scholarship_govt) ? 'Has government scholarship' : null,
        },
      })
      break
    }
  }
}

export default router
