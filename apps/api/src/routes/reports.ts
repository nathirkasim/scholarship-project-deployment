import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, isAdmin } from '../middleware/auth'
import { reportQueue } from '../jobs'
import { minioClient, BUCKET } from '../lib/minio'

const router = Router()

// POST /api/reports/generate/:programId
router.post('/generate/:programId', authenticate, isAdmin, async (req, res) => {
  const { format = 'pdf' } = req.body
  const job = await reportQueue.add('generate', {
    programId: req.params.programId,
    format,
    requestedBy: req.user!.userId,
  })
  res.json({ message: 'Report generation queued', job_id: job.id })
})

// GET /api/reports/:programId/status
router.get('/:programId/status', authenticate, isAdmin, async (req, res) => {
  // Check if a report object exists in MinIO for this program
  const pdfKey = `reports/${req.params.programId}/selection_report.pdf`
  const csvKey = `reports/${req.params.programId}/selection_report.csv`

  try {
    await minioClient.statObject(BUCKET, pdfKey)
    res.json({ status: 'ready', formats: ['pdf', 'csv'] })
  } catch {
    res.json({ status: 'not_ready', message: 'Report not yet generated. Click Generate to queue it.' })
  }
})

// GET /api/reports/:programId/download?format=pdf
router.get('/:programId/download', authenticate, isAdmin, async (req, res) => {
  const format = (req.query.format as string) || 'pdf'
  const objectKey = `reports/${req.params.programId}/selection_report.${format}`

  try {
    // Verify object exists before generating URL
    await minioClient.statObject(BUCKET, objectKey)
    // Pre-signed URL valid for 10 minutes
    const url = await minioClient.presignedGetObject(BUCKET, objectKey, 600)
    res.json({ url, expires_in: 600 })
  } catch {
    res.status(404).json({ error: 'Report not found. Generate the report first.' })
  }
})

export default router
