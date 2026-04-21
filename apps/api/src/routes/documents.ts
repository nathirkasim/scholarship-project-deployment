import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { authenticate, isOfficer } from '../middleware/auth'
import { minioClient, BUCKET } from '../lib/minio'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// Upload document
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  const { document_type } = req.body
  let { application_id } = req.body
  if (!document_type) return res.status(400).json({ error: 'document_type required' })

  // Auto-resolve application_id from the authenticated user if not provided
  if (!application_id) {
    const app = await prisma.application.findFirst({
      where: { user_id: req.user!.userId },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    })
    if (!app) return res.status(400).json({ error: 'No application found for this user' })
    application_id = app.id
  }

  const storageKey = `docs/${req.user!.userId}/${application_id}/${document_type}_${Date.now()}_${req.file.originalname}`
  const fileSizeKb = Math.ceil(req.file.size / 1024)

  try {
    await minioClient.putObject(BUCKET, storageKey, req.file.buffer, req.file.size, {
      'Content-Type': req.file.mimetype,
    })

    // Find existing doc for this application + type and replace it, or create new
    const existing = await prisma.document.findFirst({
      where: { application_id, doc_type: document_type },
    })

    let doc
    if (existing) {
      // Delete old object from MinIO (best-effort)
      minioClient.removeObject(BUCKET, existing.storage_key).catch(() => {})
      doc = await prisma.document.update({
        where: { id: existing.id },
        data: {
          storage_key: storageKey,
          original_name: req.file.originalname,
          file_size_kb: fileSizeKb,
          mime_type: req.file.mimetype,
          status: 'pending',
          rejection_note: null,
        },
      })
    } else {
      doc = await prisma.document.create({
        data: {
          application_id,
          doc_type: document_type,
          storage_key: storageKey,
          original_name: req.file.originalname,
          file_size_kb: fileSizeKb,
          mime_type: req.file.mimetype,
          status: 'pending',
        },
      })
    }

    res.status(201).json({ document: doc })
  } catch (err) {
    console.error('MinIO upload error:', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// Get presigned download URL
router.get('/:id/download', authenticate, async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } })
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  try {
    const url = await minioClient.presignedGetObject(BUCKET, doc.storage_key, 300) // 5 min TTL
    res.json({ url })
  } catch {
    res.status(500).json({ error: 'Could not generate download URL' })
  }
})

// List my documents
router.get('/my', authenticate, async (req, res) => {
  const apps = await prisma.application.findMany({
    where: { user_id: req.user!.userId },
    select: { id: true },
  })
  const appIds = apps.map(a => a.id)
  const docs = await prisma.document.findMany({
    where: { application_id: { in: appIds } },
    orderBy: { created_at: 'desc' },
  })
  res.json(docs)
})

// Update document status (officer/admin)
router.patch('/:id/status', authenticate, isOfficer, async (req, res) => {
  const { status, rejection_note } = req.body
  const doc = await prisma.document.update({
    where: { id: req.params.id },
    data: { status, rejection_note: rejection_note ?? null },
  })
  res.json({ document: doc })
})

export default router
