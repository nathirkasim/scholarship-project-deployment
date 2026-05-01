import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, isAdmin } from '../middleware/auth'
import { logStatusChange } from '../services/scoring/statusLog'
import { sendNotification } from '../services/notifications'
import { runTOPSIS, selectForVerification, autoFinalizeDecisions } from '../services/scoring/ruleEngine'

const router = Router()


// GET /api/officer/analytics/:programId
router.get('/analytics/:programId', authenticate, isAdmin, async (req, res) => {
  const pid = req.params.programId

  const [rawStatusCounts, scoreStats, anomalyStats] = await Promise.all([
    prisma.application.groupBy({
      by: ['status'], where: { program_id: pid }, _count: { id: true },
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

  const statusCounts = rawStatusCounts.map(s => ({ status: s.status, _count: s._count.id }))
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
      include: {
        user: { select: { full_name: true, email: true } },
        program: { select: { program_name: true } },
      },
      orderBy: [{ composite_rank: { sort: 'asc', nulls: 'last' } }, { composite_score: 'desc' }, { created_at: 'asc' }],
      skip, take: parseInt(String(limit)),
    }),
    prisma.application.count({ where }),
  ])
  res.json({ applications, total, program: { id: program.id, program_name: program.program_name } })
})

// POST /api/officer/trigger-topsis  run TOPSIS ranking on active program (manual re-run)
router.post('/trigger-topsis', authenticate, isAdmin, async (_req, res) => {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { res.status(404).json({ error: 'No active program' }); return }

  const count = await prisma.application.count({
    where: { program_id: program.id, status: { in: ['scored', 'verification_pending', 'verification_complete', 'approved', 'waitlisted'] } },
  })
  if (count === 0) {
    res.status(400).json({ error: 'No scored applications found' })
    return
  }

  await runTOPSIS(program.id)
  res.json({ message: `TOPSIS ranking re-computed for ${count} applications` })
})

// POST /api/officer/trigger-verification
// Moves top N scored apps to verification_pending and auto-assigns verifiers round-robin.
// Uses shared selectForVerification utility (same logic as auto-pipeline).
router.post('/trigger-verification', authenticate, isAdmin, async (_req, res) => {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { res.status(404).json({ error: 'No active program' }); return }

  const result = await selectForVerification(program.id)

  if (result.moved === 0) {
    res.status(400).json({ error: 'No scored applications found' }); return
  }

  res.json({
    message: `${result.moved} applications moved to verification_pending` +
             (result.verifiers > 0 ? ` and auto-assigned to ${result.verifiers} verifier(s)` : ' (no active verifiers found — assign manually)'),
  })
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
    select: { user_id: true, status: true, program_id: true, final_decision: true },
  })

  const overridableStatuses = ['verification_complete', 'approved', 'waitlisted', 'rejected']
  if (!overridableStatuses.includes(app.status)) {
    res.status(400).json({ error: `Cannot override decision for application in status '${app.status}'` }); return
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

  await logStatusChange(applicationId, app.status, decision, req.user!.userId, reason ? `Admin override: ${reason}` : `Admin override → ${decision}`)

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
  if (decision !== app.final_decision) {
    await sendNotification(app.user_id, applicationId, 'status_update', titleMap[decision]!, msgMap[decision]!)
  }

  res.json({ message: `Application ${decision}`, application: updated })
})

// POST /api/officer/finalize-decisions  (re-)apply final decisions to all verified apps
router.post('/finalize-decisions', authenticate, isAdmin, async (_req, res) => {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { res.status(404).json({ error: 'No active program' }); return }

  await autoFinalizeDecisions(program.id)
  res.json({ message: `Final decisions re-applied for program ${program.program_name} (top ${program.total_seats} approved, next 50 waitlisted, rest rejected — apply next year)` })
})

// GET /api/officer/decisions  auto-finalizes then returns audit trail for active program
router.get('/decisions', authenticate, isAdmin, async (_req, res) => {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })

  // Auto-finalize: always run — idempotent, deduplicates notifications internally
  if (program) {
    try {
      await autoFinalizeDecisions(program.id)
    } catch (err) {
      console.error('[AutoFinalize] Error during GET /decisions trigger:', err)
    }
  }

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
    take: 500,
  })
  res.json({ decisions })
})

export default router
