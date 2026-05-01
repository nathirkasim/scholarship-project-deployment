import { Worker, Queue } from 'bullmq'
import { redis } from '../lib/redis'
import { logger } from '../lib/logger'
import { runEvaluation } from '../services/scoring/ruleEngine'

// ─── QUEUES (exported for use in routes) ────────────────────────────────────

export const evaluationQueue = new Queue('evaluation', {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 200 },
})

export const reportQueue = new Queue('report-generate', {
  connection: redis,
  defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 20, removeOnFail: 20 },
})

// ─── WORKERS ─────────────────────────────────────────────────────────────────

export function startWorkers() {
  // Single evaluation worker — runs anomaly check + eligibility gates + rule scoring in one pass.
  // Result: 'rejected' (anomaly/fraud), 'not_shortlisted', or 'evaluated' (WSM provisional stored).
  // Admin triggers TOPSIS separately via POST /officer/trigger-topsis when the window closes.
  const evaluationWorker = new Worker(
    'evaluation',
    async (job) => {
      const { applicationId } = job.data
      logger.info(`[evaluation] Processing application ${applicationId}`)
      await runEvaluation(applicationId)
    },
    { connection: redis, concurrency: 10 }
  )
  evaluationWorker.on('failed', (job, err) => {
    logger.error(`[evaluation] Job ${job?.id} failed: ${err.message}`)
  })

  // Report generation worker
  const reportWorker = new Worker(
    'report-generate',
    async (job) => {
      const { programId, format } = job.data
      logger.info(`[report-generate] Generating ${format} for program ${programId}`)
      const { generateReport } = await import('../services/reports/reportGenerator')
      await generateReport(programId, format)
    },
    { connection: redis, concurrency: 2 }
  )
  reportWorker.on('failed', (job, err) => {
    logger.error(`[report-generate] Job ${job?.id} failed: ${err.message}`)
  })

  logger.info('All BullMQ workers started')
}
