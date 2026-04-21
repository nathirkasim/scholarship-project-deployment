import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, isAdmin, isOfficer, isStaff } from '../middleware/auth'
import { scoringQueue } from '../jobs'

const router = Router()

const ProgramSchema = z.object({
  program_name: z.string().min(3),
  program_code: z.string().min(3),
  academic_year: z.string(),
  description: z.string().optional(),
  total_seats: z.number().int().positive().default(100),
  shortlist_multiplier: z.number().min(1).max(5).default(2),
  application_start: z.string().datetime(),
  application_end: z.string().datetime(),
})

// GET /api/programs
router.get('/', authenticate, async (req, res) => {
  const programs = await prisma.scholarshipProgram.findMany({
    where: { is_active: true },
    orderBy: { created_at: 'desc' },
  })
  res.json({ programs })
})

// POST /api/programs
router.post('/', authenticate, isAdmin, async (req, res) => {
  const body = ProgramSchema.safeParse(req.body)
  if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return }

  const program = await prisma.scholarshipProgram.create({
    data: { ...body.data, created_by: req.user!.userId },
  })
  res.status(201).json({ program })
})

// GET /api/programs/:id
router.get('/:id', authenticate, async (req, res) => {
  const program = await prisma.scholarshipProgram.findUniqueOrThrow({ where: { id: req.params.id } })
  res.json({ program })
})

// PUT /api/programs/:id
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  const program = await prisma.scholarshipProgram.update({
    where: { id: req.params.id },
    data: req.body,
  })
  res.json({ program })
})

// GET /api/programs/:id/applications  ranked list
router.get('/:id/applications', authenticate, isStaff, async (req, res) => {
  const { status, page = '1', limit = '50' } = req.query
  const skip = (parseInt(String(page)) - 1) * parseInt(String(limit))

  const where: Record<string, unknown> = { program_id: req.params.id }
  if (status) where['status'] = String(status)

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: { user: { select: { full_name: true, email: true } } },
      orderBy: [{ composite_score: 'desc' }, { created_at: 'asc' }],
      skip, take: parseInt(String(limit)),
    }),
    prisma.application.count({ where }),
  ])

  res.json({ applications, total, page: parseInt(String(page)), limit: parseInt(String(limit)) })
})

// POST /api/programs/:id/trigger-scoring  batch Phase 3
router.post('/:id/trigger-scoring', authenticate, isOfficer, async (req, res) => {
  const shortlisted = await prisma.application.findMany({
    where: { program_id: req.params.id, status: 'shortlisted' },
    select: { id: true },
  })

  const jobs = shortlisted.map(app =>
    scoringQueue.add('scoring', { applicationId: app.id })
  )
  await Promise.all(jobs)

  res.json({ message: `Scoring queued for ${shortlisted.length} applications` })
})

// POST /api/programs/:id/trigger-verification  open for verifier assignment
router.post('/:id/trigger-verification', authenticate, isOfficer, async (req, res) => {
  const program = await prisma.scholarshipProgram.findUniqueOrThrow({ where: { id: req.params.id } })
  const limit = program.total_seats * 2  // top 200

  const topApps = await prisma.application.findMany({
    where: { program_id: req.params.id, status: 'scored' },
    orderBy: { composite_score: 'desc' },
    take: limit,
  })

  await prisma.application.updateMany({
    where: { id: { in: topApps.map(a => a.id) } },
    data: { status: 'verification_pending' },
  })

  res.json({ message: `${topApps.length} applications moved to verification_pending` })
})

// GET /api/programs/:id/rules/overrides
router.get('/:id/rules/overrides', authenticate, isStaff, async (req, res) => {
  const overrides = await prisma.programRuleOverride.findMany({
    where: { program_id: req.params.id, is_active: true },
    include: { rule: { select: { rule_code: true, rule_name: true, domain: true } } },
  })
  res.json({ overrides })
})

// POST /api/programs/:id/rules/overrides
router.post('/:id/rules/overrides', authenticate, isOfficer, async (req, res) => {
  const { rule_id, override_value } = req.body
  const override = await prisma.programRuleOverride.upsert({
    where: { program_id_rule_id: { program_id: req.params.id, rule_id } },
    update: { override_value, is_active: true },
    create: { program_id: req.params.id, rule_id, override_value, is_active: true, created_by: req.user!.userId },
  })
  res.json({ override })
})

export default router
