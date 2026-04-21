import { Worker, Queue } from 'bullmq'
import { redis } from '../lib/redis'
import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'
import { runAnomalyPreFilter } from '../services/anomaly/anomalyPreFilter'
import { runScoringEngine, runTOPSIS } from '../services/scoring/ruleEngine'

//  QUEUES (exported for use in routes) 
export const anomalyQueue = new Queue('anomaly-check', {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 200 },
})

export const scoringQueue = new Queue('scoring', {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10000 }, removeOnComplete: 100, removeOnFail: 200 },
})

export const reportQueue = new Queue('report-generate', {
  connection: redis,
  defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 20, removeOnFail: 20 },
})

//  WORKERS 
export function startWorkers() {
  // Phase 1  Anomaly pre-filter worker
  const anomalyWorker = new Worker(
    'anomaly-check',
    async (job) => {
      const { applicationId } = job.data
      logger.info(`[anomaly-check] Processing application ${applicationId}`)
      await runAnomalyPreFilter(applicationId)
    },
    { connection: redis, concurrency: 10 }
  )
  anomalyWorker.on('failed', (job, err) => {
    logger.error(`[anomaly-check] Job ${job?.id} failed: ${err.message}`)
  })

  // Phase 3  Scoring worker
  // After each application is individually scored, checks if all shortlisted
  // applications for the program are done. If so, triggers the TOPSIS batch
  // ranking step which overwrites the provisional WSM composite_score with
  // the cohort-relative TOPSIS closeness coefficient.
  const scoringWorker = new Worker(
    'scoring',
    async (job) => {
      const { applicationId } = job.data
      logger.info(`[scoring] Scoring application ${applicationId}`)
      await runScoringEngine(applicationId)

      // Check if any shortlisted apps remain for this program
      const app = await prisma.application.findUnique({
        where:  { id: applicationId },
        select: { program_id: true },
      })
      if (!app) return

      const pendingCount = await prisma.application.count({
        where: { program_id: app.program_id, status: 'shortlisted' },
      })

      if (pendingCount === 0) {
        logger.info(`[TOPSIS] All applications scored for program ${app.program_id}  running TOPSIS ranking`)
        await runTOPSIS(app.program_id)
      }
    },
    { connection: redis, concurrency: 5 }
  )
  scoringWorker.on('failed', (job, err) => {
    logger.error(`[scoring] Job ${job?.id} failed: ${err.message}`)
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
