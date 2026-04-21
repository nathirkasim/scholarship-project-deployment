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
  const rule = await prisma.eligibilityRule.create({ data: req.body })
  res.status(201).json({ rule })
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
  res.json({ programs })
})

router.post('/programs', authenticate, isAdmin, async (req, res) => {
  const { program_name, program_code, academic_year, description, total_seats,
          application_start, application_end, is_active } = req.body
  const program = await prisma.scholarshipProgram.create({
    data: {
      program_name, program_code, academic_year, description,
      total_seats: total_seats ?? 100,
      application_start: new Date(application_start),
      application_end: new Date(application_end),
      is_active: is_active ?? true,
      created_by: req.user!.userId,
    },
  })
  res.status(201).json({ program })
})

router.put('/programs/:id', authenticate, isAdmin, async (req, res) => {
  const { program_name, academic_year, description, total_seats,
          application_start, application_end, is_active } = req.body
  const data: Record<string, unknown> = {}
  if (program_name !== undefined) data.program_name = program_name
  if (academic_year !== undefined) data.academic_year = academic_year
  if (description !== undefined) data.description = description
  if (total_seats !== undefined) data.total_seats = total_seats
  if (application_start !== undefined) data.application_start = new Date(application_start)
  if (application_end !== undefined) data.application_end = new Date(application_end)
  if (is_active !== undefined) data.is_active = is_active
  const program = await prisma.scholarshipProgram.update({ where: { id: req.params.id }, data })
  res.json({ program })
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
  const { is_active } = req.body
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { is_active },
    select: { id: true, email: true, role: true, is_active: true },
  })
  res.json({ user })
})

// Institutions
router.get('/institutions', authenticate, isAdmin, async (_req, res) => {
  const institutions = await prisma.institution.findMany({ orderBy: { name: 'asc' } })
  res.json({ institutions })
})

router.post('/institutions', authenticate, isAdmin, async (req, res) => {
  const institution = await prisma.institution.create({ data: req.body })
  res.status(201).json({ institution })
})

router.put('/institutions/:id', authenticate, isAdmin, async (req, res) => {
  const institution = await prisma.institution.update({ where: { id: req.params.id }, data: req.body })
  res.json({ institution })
})

//  Settings 
// We store settings as a JSON blob keyed by 'global' in a simple KV approach
// using the EligibilityRule CONFIG type rows.  For now, keep in-memory with
// a simple fallback so the settings page renders without errors.
const _settingsCache: Record<string, unknown> = {
  trust_name: 'Scholarship Trust',
  max_selections: 100,
  waitlist_size: 20,
  anomaly_threshold: 0.65,
  notification_email: '',
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
