import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, isAdmin } from '../middleware/auth'
import { logStatusChange } from '../services/scoring/statusLog'
import { sendNotification } from '../services/notifications'
import { runTOPSIS } from '../services/scoring/ruleEngine'

const router = Router()


// GET /api/officer/analytics/:programId
router.get('/analytics/:programId', authenticate, isAdmin, async (req, res) => {
  const pid = req.params.programId

  const [statusCounts, scoreStats, anomalyStats] = await Promise.all([
    prisma.application.groupBy({
      by: ['status'], where: { program_id: pid }, _count: true,
    }),
    prisma.application.aggregate({
      where: {
        program_id: pid,
        composite_score: { not: null },
        status: { in: ['scored', 'verification_pending', 'verification_complete', 'approved', 'waitlisted', 'rejected'] },
      },
      _avg: { merit_score: true, rule_need_score: true, composite_score: true, integrity_adj: true },
      _max: { composite_score: true },
      _min: { composite_score: true },
    }),
    prisma.application.aggregate({
      where: { program_id: pid, anomaly_flag: true },
      _count: { id: true },
      _avg: { anomaly_score: true },
    }),
  ])

  res.json({ statusCounts, scoreStats, anomalyStats })
})

// GET /api/officer/applications  all applications for the active program
router.get('/applications', authenticate, isAdmin, async (req, res) => {
  const { status, page = '1', limit = '50' } = req.query
  const skip = (parseInt(String(page)) - 1) * parseInt(String(limit))

  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { res.status(404).json({ error: 'No active program' }); return }

  const where: Record<string, unknown> = { program_id: program.id }
  if (status) where['status'] = String(status)

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: { user: { select: { full_name: true, email: true } } },
      orderBy: [{ composite_rank: { sort: 'asc', nulls: 'last' } }, { composite_score: 'desc' }, { created_at: 'asc' }],
      skip, take: parseInt(String(limit)),
    }),
    prisma.application.count({ where }),
  ])
  res.json({ applications, total, program: { id: program.id, program_name: program.program_name } })
})

// POST /api/officer/trigger-topsis  run TOPSIS ranking on active program
router.post('/trigger-topsis', authenticate, isAdmin, async (_req, res) => {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { res.status(404).json({ error: 'No active program' }); return }

  const count = await prisma.application.count({
    where: { program_id: program.id, status: 'evaluated' },
  })
  if (count === 0) {
    res.status(400).json({ error: 'No evaluated applications found' })
    return
  }

  await runTOPSIS(program.id)
  res.json({ message: `TOPSIS ranking computed for ${count} applications` })
})

// POST /api/officer/trigger-verification  move top 200 to verification_pending
router.post('/trigger-verification', authenticate, isAdmin, async (_req, res) => {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { res.status(404).json({ error: 'No active program' }); return }

  const limit = program.total_seats * 2
  const topApps = await prisma.application.findMany({
    where: { program_id: program.id, status: 'scored' },
    orderBy: { composite_score: 'desc' },
    take: limit,
  })
  await prisma.application.updateMany({
    where: { id: { in: topApps.map(a => a.id) } },
    data: { status: 'verification_pending' },
  })
  // retrainQueue removed  XGBoost eliminated, Isolation Forest does not need retraining
  res.json({ message: `${topApps.length} applications moved to verification_pending` })
})

// POST /api/officer/decide  set final_decision on a verification_complete application
router.post('/decide', authenticate, isAdmin, async (req, res) => {
  const { applicationId, decision, reason } = req.body
  if (!applicationId || !decision) {
    res.status(400).json({ error: 'applicationId and decision required' }); return
  }
  if (!['approved', 'waitlisted', 'rejected'].includes(decision)) {
    res.status(400).json({ error: 'decision must be approved, waitlisted, or rejected' }); return
  }

  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { user_id: true, status: true, program_id: true },
  })

  if (app.status !== 'verification_complete') {
    res.status(400).json({ error: `Cannot decide application in status '${app.status}' — must be verification_complete` }); return
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      final_decision:  decision,
      status:          decision,
      rejection_reason: reason ?? null,
      decided_by_id:   req.user!.userId,
      decided_at:      new Date(),
    },
  })

  await logStatusChange(applicationId, app.status, decision, req.user!.userId, reason ?? `Final decision: ${decision}`)

  const titleMap: Record<string, string> = {
    approved:   'Application Approved',
    waitlisted: 'Application Waitlisted',
    rejected:   'Application Rejected',
  }
  const msgMap: Record<string, string> = {
    approved:   'Congratulations! Your application has been approved for the scholarship.',
    waitlisted: 'Your application has been placed on the waitlist. You may be selected if a seat becomes available.',
    rejected:   `Your application was not selected.${reason ? ' Reason: ' + reason : ''}`,
  }
  await sendNotification(app.user_id, applicationId, 'status_update', titleMap[decision]!, msgMap[decision]!)

  res.json({ message: `Application ${decision}`, application: updated })
})

// GET /api/officer/decisions  audit trail for active program
router.get('/decisions', authenticate, isAdmin, async (_req, res) => {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  const decisions = await prisma.application.findMany({
    where: {
      final_decision: { not: null },
      ...(program ? { program_id: program.id } : {}),
    },
    include: {
      user: { select: { full_name: true, email: true } },
      program: { select: { program_name: true } },
    },
    orderBy: { decided_at: 'desc' },
    take: 200,
  })
  res.json({ decisions })
})

export default router
