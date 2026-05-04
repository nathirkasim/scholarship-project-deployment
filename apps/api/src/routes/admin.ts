
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { authenticate, isAdmin } from '../middleware/auth'
import { mlClient } from '../services/mlClient'

const router = Router()

//  Rules management
router.get('/rules', authenticate, isAdmin, async (_req, res) => {
  const rules = await prisma.eligibilityRule.findMany({ orderBy: { sort_order: 'asc' } })
  res.json({ rules })
})

router.post('/rules', authenticate, isAdmin, async (req, res) => {
  try {
    const rule = await prisma.eligibilityRule.create({
      data: {
        ...req.body,
        default_value: req.body.default_value ?? {},
        operator:      req.body.operator      ?? 'EQ',
        value_type:    req.body.value_type    ?? 'number',
        score_bucket:  req.body.score_bucket  ?? 'none',
        sort_order:    req.body.sort_order    ?? 999,
      },
    })
    res.status(201).json({ rule })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: `Rule code '${req.body.rule_code}' already exists. Use a unique rule code.` }); return
    }
    throw err
  }
})

router.patch('/rules/:id', authenticate, isAdmin, async (req, res) => {
  const rule = await prisma.eligibilityRule.update({ where: { id: req.params.id }, data: req.body })
  res.json({ rule })
})

router.put('/rules/:id', authenticate, isAdmin, async (req, res) => {
  const rule = await prisma.eligibilityRule.update({ where: { id: req.params.id }, data: req.body })
  res.json({ rule })
})

//  Programs management (admin proxies to program routes)
router.get('/programs', authenticate, isAdmin, async (_req, res) => {
  const programs = await prisma.scholarshipProgram.findMany({ orderBy: { created_at: 'desc' } })
  res.json({ programs: programs.map(fmtProgram) })
})

router.post('/programs', authenticate, isAdmin, async (req, res) => {
  const { program_name, program_code, academic_year, description, total_seats, is_active } = req.body
  const program = await prisma.scholarshipProgram.create({
    data: {
      program_name, program_code, academic_year,
      description: description ?? null,
      total_seats: total_seats ?? 50,
      is_active: is_active ?? true,
      created_by: req.user!.userId,
    },
  })
  res.status(201).json({ program: fmtProgram(program) })
})

function programUpdateData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  if (body.program_name !== undefined)  data.program_name  = body.program_name
  if (body.academic_year !== undefined) data.academic_year = body.academic_year
  if (body.description !== undefined)   data.description   = body.description
  if (body.total_seats !== undefined)   data.total_seats   = body.total_seats
  if (body.is_active !== undefined)     data.is_active     = body.is_active
  return data
}

function fmtProgram(p: any) {
  return { ...p, waitlist_seats: 50 }
}

router.put('/programs/:id', authenticate, isAdmin, async (req, res) => {
  const program = await prisma.scholarshipProgram.update({
    where: { id: req.params.id },
    data: programUpdateData(req.body),
  })
  res.json({ program: fmtProgram(program) })
})

router.patch('/programs/:id', authenticate, isAdmin, async (req, res) => {
  const program = await prisma.scholarshipProgram.update({
    where: { id: req.params.id },
    data: programUpdateData(req.body),
  })
  res.json({ program: fmtProgram(program) })
})

//  ML status + anomaly test (Isolation Forest only)
router.get('/ml/status', authenticate, isAdmin, async (_req, res) => {
  try {
    const mlRes = await fetch(`${process.env.ML_SERVICE_URL || 'http://ml-service:5000'}/health`)
    const status = await mlRes.json()
    res.json(status)
  } catch {
    res.status(502).json({ error: 'ML service unavailable' })
  }
})

router.post('/ml/test-anomaly', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await mlClient.detectAnomaly(req.body.features as Parameters<typeof mlClient.detectAnomaly>[0])
    res.json(result)
  } catch {
    res.status(502).json({ error: 'ML service error' })
  }
})

// GET /api/admin/ml/anomaly-stats  — aggregate stats for the ML config dashboard
router.get('/ml/anomaly-stats', authenticate, isAdmin, async (_req, res) => {
  const [flaggedCount, totalEvaluated, scoreAgg, recentFlagged] = await Promise.all([
    prisma.application.count({ where: { anomaly_flag: true } }),
    prisma.application.count({ where: { status: { not: 'draft' } } }),
    prisma.application.aggregate({
      where: { anomaly_flag: true },
      _avg: { anomaly_score: true },
      _max: { anomaly_score: true },
    }),
    prisma.application.findMany({
      where: { anomaly_flag: true },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: {
        id: true,
        anomaly_score: true,
        anomaly_reasons: true,
        created_at: true,
        user: { select: { full_name: true } },
        program: { select: { program_name: true } },
      },
    }),
  ])

  res.json({
    flagged_count:   flaggedCount,
    total_evaluated: totalEvaluated,
    flag_rate:       totalEvaluated > 0 ? ((flaggedCount / totalEvaluated) * 100).toFixed(1) : '0.0',
    avg_score:       scoreAgg._avg.anomaly_score,
    max_score:       scoreAgg._max.anomaly_score,
    recent_flagged:  recentFlagged,
  })
})

// GET /api/admin/ml/config  returns program rule overrides (anomaly threshold)
router.get('/ml/config', authenticate, isAdmin, async (req, res) => {
  const { program_id } = req.query
  if (!program_id) { res.status(400).json({ error: 'program_id required' }); return }
  const overrides = await prisma.programRuleOverride.findMany({
    where: { program_id: String(program_id) },
    include: { rule: { select: { rule_code: true } } },
  })
  res.json({ overrides })
})

//  Users
router.get('/users', authenticate, isAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, full_name: true, phone: true, role: true, is_active: true, created_at: true },
    orderBy: { created_at: 'desc' },
  })
  res.json({ users: users.map(u => ({ ...u, name: u.full_name })) })
})

router.post('/users', authenticate, isAdmin, async (req, res) => {
  const { email, password, full_name, phone, role } = req.body
  const password_hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({ data: { email, password_hash, full_name, phone, role } })
  res.status(201).json({ user: { id: user.id, email: user.email, role: user.role } })
})

router.put('/users/:id', authenticate, isAdmin, async (req, res) => {
  const { is_active, role, full_name, phone } = req.body
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { is_active, role, full_name, phone },
    select: { id: true, email: true, role: true, is_active: true },
  })
  res.json({ user })
})

router.patch('/users/:id', authenticate, isAdmin, async (req, res) => {
  const { is_active, role } = req.body
  const data: Record<string, unknown> = {}
  if (is_active !== undefined) data.is_active = is_active
  if (role     !== undefined) data.role      = role
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, email: true, full_name: true, role: true, is_active: true },
  })
  res.json({ user })
})

//  Settings
// We store settings as a JSON blob keyed by 'global' in a simple KV approach
// using the EligibilityRule CONFIG type rows.  For now, keep in-memory with
// a simple fallback so the settings page renders without errors.
const _settingsCache: Record<string, unknown> = {
  app_name: 'Scholarship Selection Platform',
  support_email: 'support@scholarship.org',
  max_applications_per_user: 3,
  enable_notifications: true,
  require_doc_upload: true,
  verification_gps_required: false,
  session_timeout_minutes: 60,
  maintenance_mode: false,
}

router.get('/settings', authenticate, isAdmin, async (_req, res) => {
  res.json({ settings: _settingsCache })
})

router.post('/settings', authenticate, isAdmin, async (req, res) => {
  const body = req.body?.settings ?? req.body
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'settings object required' }); return
  }
  Object.assign(_settingsCache, body)
  res.json({ settings: _settingsCache })
})

router.patch('/settings', authenticate, isAdmin, async (req, res) => {
  const body = req.body?.settings ?? req.body
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'settings object required' }); return
  }
  Object.assign(_settingsCache, body)
  res.json({ settings: _settingsCache })
})

export default router
