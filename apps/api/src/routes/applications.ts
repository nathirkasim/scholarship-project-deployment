import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, isStudent } from '../middleware/auth'
import { anomalyQueue, scoringQueue } from '../jobs'

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
    where: { program_id, user_id: req.user!.userId, status: { not: 'rejected' } },
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
  })
  if (!app) { res.status(404).json({ error: 'Application not found or already submitted' }); return }

  await prisma.application.update({
    where: { id: app.id },
    data: { status: 'submitted', submitted_at: new Date() },
  })

  // Enqueue Phase 1 anomaly job
  await anomalyQueue.add('anomaly-check', { applicationId: app.id }, { priority: 1 })

  res.json({ message: 'Application submitted. Anomaly check queued.', application_id: app.id })
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
  switch (step) {
    case 1: // Personal
      await prisma.studentPersonal.upsert({
        where: { user_id: userId }, update: data as any, create: { user_id: userId, ...data } as any,
      }); break
    case 2: // Academic
      await prisma.studentAcademic.upsert({
        where: { user_id: userId }, update: data as any, create: { user_id: userId, ...data } as any,
      }); break
    case 3: // Family
      await prisma.studentFamily.upsert({
        where: { user_id: userId }, update: data as any, create: { user_id: userId, ...data } as any,
      }); break
    case 4: // Financial
      await prisma.studentFinancial.upsert({
        where: { user_id: userId }, update: data as any, create: { user_id: userId, ...data } as any,
      }); break
    case 5: // Assets
      await prisma.studentAssets.upsert({
        where: { user_id: userId }, update: data as any, create: { user_id: userId, ...data } as any,
      }); break
    case 6: { // Housing  form sends cooking_fuel string; schema stores has_lpg boolean
      const { cooking_fuel, ...housingRest } = data as Record<string, unknown>
      const has_lpg = cooking_fuel === 'lpg'
      const housingData = { ...housingRest, has_lpg }
      await prisma.studentHousing.upsert({
        where: { user_id: userId }, update: housingData as any, create: { user_id: userId, ...housingData } as any,
      }); break
    }
    case 7: // Benefits
      await prisma.studentGovtBenefits.upsert({
        where: { user_id: userId }, update: data as any, create: { user_id: userId, ...data } as any,
      }); break
  }
}

export default router
