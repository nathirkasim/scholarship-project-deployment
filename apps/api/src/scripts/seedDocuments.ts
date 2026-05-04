/**
 * Seed dummy documents for every application in the database.
 *
 * For each application that has no documents yet, uploads 6 standard
 * document types as minimal PDF files to MinIO and inserts Document rows.
 *
 * Run from apps/api/:
 *   npx tsx src/scripts/seedDocuments.ts
 *
 * Prerequisites: DATABASE_URL env set, MinIO running on port 9000.
 */

import * as path   from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import { PrismaClient } from '@prisma/client'
import * as Minio from 'minio'

const prisma = new PrismaClient()

const BUCKET = process.env.MINIO_BUCKET || 'scholarship-docs'

const minio = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT  || 'localhost',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
})

// Standard document types every applicant must submit
const DOC_TYPES = [
  { type: 'aadhaar_card',       label: 'Aadhaar Card' },
  { type: 'income_certificate', label: 'Income Certificate' },
  { type: 'marksheet_hsc',      label: '12th / HSC Marksheet' },
  { type: 'marksheet_ug',       label: 'UG Marksheet / Transcript' },
  { type: 'ration_card',        label: 'Ration Card' },
  { type: 'bank_passbook',      label: 'Bank Passbook (first page)' },
]

/**
 * Generates a minimal but valid single-page PDF as a Buffer.
 * The page contains the document label and applicant name.
 */
function makeDummyPdf(docLabel: string, applicantName: string): Buffer {
  const title   = `${docLabel} — ${applicantName}`
  const escaped = title.replace(/[()\\]/g, '\\$&')

  const content = [
    'BT',
    '/F1 14 Tf',
    '72 720 Td',
    `(${escaped}) Tj`,
    '/F1 11 Tf',
    '0 -24 Td',
    '(DUMMY DOCUMENT — FOR TESTING ONLY) Tj',
    'ET',
  ].join('\n')

  const stream   = `stream\n${content}\nendstream`
  const streamLen = Buffer.byteLength(content, 'utf8') + 'stream\n'.length + '\nendstream'.length

  const objects: string[] = []

  // obj 1 — catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')
  // obj 2 — pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj')
  // obj 3 — page
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj')
  // obj 4 — content stream
  objects.push(`4 0 obj\n<< /Length ${streamLen} >>\n${stream}\nendobj`)
  // obj 5 — font
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj')

  let body = '%PDF-1.4\n'
  const offsets: number[] = []

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body, 'latin1'))
    body += objects[i] + '\n'
  }

  const xrefOffset = Buffer.byteLength(body, 'latin1')
  body += 'xref\n'
  body += `0 ${objects.length + 1}\n`
  body += '0000000000 65535 f \n'
  for (const off of offsets) {
    body += String(off).padStart(10, '0') + ' 00000 n \n'
  }
  body += 'trailer\n'
  body += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  body += 'startxref\n'
  body += `${xrefOffset}\n`
  body += '%%EOF'

  return Buffer.from(body, 'latin1')
}

async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET)
  if (!exists) {
    await minio.makeBucket(BUCKET, 'ap-south-1')
    console.log(`Created bucket: ${BUCKET}`)
  }
}

async function main() {
  await ensureBucket()

  // Load all applications with their user info and existing doc count
  const applications = await prisma.application.findMany({
    select: {
      id:      true,
      user_id: true,
      user:    { select: { full_name: true } },
      _count:  { select: { documents: true } },
    },
    orderBy: { created_at: 'asc' },
  })

  console.log(`Found ${applications.length} applications`)

  let uploaded = 0
  let skipped  = 0

  for (const app of applications) {
    if (app._count.documents > 0) {
      console.log(`  skip  ${app.user.full_name} — already has ${app._count.documents} doc(s)`)
      skipped++
      continue
    }

    console.log(`  upload  ${app.user.full_name} (${app.id.slice(0, 8)}…)`)

    for (const { type, label } of DOC_TYPES) {
      const pdfBuffer  = makeDummyPdf(label, app.user.full_name)
      const fileName   = `${type}_dummy.pdf`
      const storageKey = `docs/${app.user_id}/${app.id}/${type}_${Date.now()}_${fileName}`

      await minio.putObject(BUCKET, storageKey, pdfBuffer, pdfBuffer.length, {
        'Content-Type': 'application/pdf',
      })

      await prisma.document.create({
        data: {
          application_id: app.id,
          doc_type:       type,
          original_name:  fileName,
          storage_key:    storageKey,
          file_size_kb:   Math.ceil(pdfBuffer.length / 1024),
          mime_type:      'application/pdf',
          status:         'pending',
        },
      })
    }

    console.log(`    → ${DOC_TYPES.length} documents uploaded`)
    uploaded++
  }

  console.log(`\nDone. Uploaded docs for ${uploaded} applications, skipped ${skipped}.`)
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
