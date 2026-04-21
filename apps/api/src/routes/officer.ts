import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, isOfficer } from '../middleware/auth'
import { logStatusChange } from '../services/scoring/statusLog'
import { sendNotification } from '../services/notifications'
import { runShortlistCheck } from '../services/anomaly/anomalyPreFilter'
import { scoringQueue } from '../jobs'

const router = Router()

// GET /api/officer/review-queue  anomaly flagged + I-03 cases
router.get('/review-queue', authenticate, isOfficer, async (req, res) => {
  const { program_id } = req.query

  const flagged = await prisma.application.findMany({
    where: {
      status: 'anomaly_flagged',
      ...(program_id ? { program_id: String(program_id) } : {}),
    },
    include: {
      user: { select: { full_name: true, email: true, phone: true } },
      program: { select: { program_name: true } },
    },
    orderBy: [{ anomaly_score: 'desc' }],
  })

  // I-03 band  verification_complete with match 50-79 or anomaly flag
  const reviewBand = await prisma.application.findMany({
    where: {
      status: 'verification_complete',
      OR: [
        { verification_match_score: { gte: 50, lt: 80 } },
        { anomaly_flag: true, status: 'verification_complete' },
      ],
      ...(program_id ? { program_id: String(program_id) } : {}),
    },
    include: {
      user: { select: { full_name: true, email: true } },
      program: { select: { program_name: true } },
    },
    orderBy: { composite_score: 'desc' },
  })

  res.json({ anomaly_flagged: flagged, review_band: reviewBand })
})

// POST /api/officer/review/:id/clear  clear anomaly flag
router.post('/review/:id/clear', authenticate, isOfficer, async (req, res) => {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: req.params.id, status: 'anomaly_flagged' },
  })

  await prisma.application.update({
    where: { id: app.id },
    data: { status: 'scoring_pending' },
  })

  await logStatusChange(app.id, 'anomaly_flagged', 'scoring_pending',
    req.user!.userId, req.body.reason || 'Officer cleared anomaly flag')

  // Trigger shortlist check
  await runShortlistCheck(app.id)

  res.json({ message: 'Application cleared for scoring' })
})

// POST /api/officer/review/:id/reject  reject with reason
router.post('/review/:id/reject', authenticate, isOfficer, async (req, res) => {
  const { reason } = req.body
  if (!reason) { res.status(400).json({ error: 'rejection reason required' }); return }

  const existing = await prisma.application.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { user_id: true, status: true },
  })

  await prisma.application.update({
    where: { id: req.params.id },
    data: {
      status: 'rejected',
      final_decision: 'rejected',
      rejection_reason: reason,
      decided_by_id: req.user!.userId,
      decided_at: new Date(),
    },
  })

  const app = existing

  await logStatusChange(req.params.id, existing.status, 'rejected',
    req.user!.userId, reason)

  await sendNotification(app.user_id, req.params.id, 'status_update',
    'Application Rejected',
    `Your application has been reviewed and rejected. Reason: ${reason}`)

  res.json({ message: 'Application rejected' })
})

// GET /api/officer/analytics/:programId
router.get('/analytics/:programId', authenticate, isOfficer, async (req, res) => {
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
router.get('/applications', authenticate, isOfficer, async (req, res) => {
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

// POST /api/officer/trigger-scoring  batch Phase 3 on active program
router.post('/trigger-scoring', authenticate, isOfficer, async (req, res) => {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { res.status(404).json({ error: 'No active program' }); return }

  const shortlisted = await prisma.application.findMany({
    where: { program_id: program.id, status: 'shortlisted' },
    select: { id: true },
  })
  await Promise.all(shortlisted.map(app => scoringQueue.add('scoring', { applicationId: app.id })))
  res.json({ message: `Scoring queued for ${shortlisted.length} applications` })
})

// POST /api/officer/trigger-verification  move top 200 to verification_pending
router.post('/trigger-verification', authenticate, isOfficer, async (req, res) => {
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
router.post('/decide', authenticate, isOfficer, async (req, res) => {
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
router.get('/decisions', authenticate, isOfficer, async (_req, res) => {
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
