import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { minioClient, BUCKET } from '../../lib/minio'
import PDFDocument from 'pdfkit'

export async function generateReport(programId: string, format: string): Promise<string> {
  logger.info(`Generating ${format} report for program ${programId}`)

  const program = await prisma.scholarshipProgram.findUniqueOrThrow({ where: { id: programId } })

  const [approved, rejected, waitlisted, anomalyCount, totalApps] = await Promise.all([
    prisma.application.findMany({
      where: { program_id: programId, final_decision: 'approved' },
      include: { user: { select: { full_name: true, email: true } } },
      orderBy: { post_verify_composite: 'desc' },
    }),
    prisma.application.findMany({
      where: { program_id: programId, final_decision: 'rejected' },
      include: { user: { select: { full_name: true, email: true } } },
      orderBy: { composite_score: 'desc' },
    }),
    prisma.application.findMany({
      where: { program_id: programId, final_decision: 'waitlisted' },
      include: { user: { select: { full_name: true, email: true } } },
      orderBy: { post_verify_composite: 'desc' },
    }),
    prisma.application.count({ where: { program_id: programId, anomaly_flag: true } }),
    prisma.application.count({ where: { program_id: programId } }),
  ])

  logger.info(`Report data: ${approved.length} approved, ${rejected.length} rejected, ${waitlisted.length} waitlisted, ${anomalyCount} anomaly`)

  const objectKey = `reports/${programId}/selection_report.${format}`

  if (format === 'csv') {
    //  CSV Report 
    const lines: string[] = []

    lines.push(`# ${program.program_name}  Selection Report`)
    lines.push(`# Generated: ${new Date().toISOString()}`)
    lines.push(`# Program Code: ${program.program_code} | Academic Year: ${program.academic_year}`)
    lines.push('')
    lines.push('## SUMMARY')
    lines.push(`Total Applications,${totalApps}`)
    lines.push(`Approved,${approved.length}`)
    lines.push(`Waitlisted,${waitlisted.length}`)
    lines.push(`Rejected,${rejected.length}`)
    lines.push(`Anomaly Flagged,${anomalyCount}`)
    lines.push('')

    lines.push('## APPROVED STUDENTS')
    lines.push('Rank,Full Name,Email,Merit Score,Need Score,TOPSIS Score,Post-Verify Score')
    for (let i = 0; i < approved.length; i++) {
      const a = approved[i]!
      lines.push(`${i + 1},"${a.user.full_name}","${a.user.email}",${a.merit_score ?? ''},${a.rule_need_score ?? ''},${a.composite_score ?? ''},${a.post_verify_composite ?? ''}`)
    }
    lines.push('')

    if (waitlisted.length > 0) {
      lines.push('## WAITLISTED STUDENTS')
      lines.push('Rank,Full Name,Email,TOPSIS Score,Post-Verify Score')
      for (let i = 0; i < waitlisted.length; i++) {
        const a = waitlisted[i]!
        lines.push(`${i + 1},"${a.user.full_name}","${a.user.email}",${a.composite_score ?? ''},${a.post_verify_composite ?? ''}`)
      }
      lines.push('')
    }

    lines.push('## REJECTED STUDENTS')
    lines.push('Full Name,Email,TOPSIS Score,Reason')
    for (const a of rejected) {
      const reason = (a.rejection_reason ?? '').replace(/"/g, '""')
      lines.push(`"${a.user.full_name}","${a.user.email}",${a.composite_score ?? ''},"${reason}"`)
    }

    const csvBuffer = Buffer.from(lines.join('\n'), 'utf-8')
    await minioClient.putObject(BUCKET, objectKey, csvBuffer, csvBuffer.length, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="selection_report_${program.program_code}.csv"`,
    })

    logger.info(`CSV report uploaded to MinIO: ${objectKey}`)
    return objectKey
  }

  //  PDF Report — build content as plain text lines, then render
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const pdfDone = new Promise<void>((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)
  })

  const GREEN  = '#15803d'
  const RED    = '#b91c1c'
  const GREY   = '#6b7280'
  const BLUE   = '#1e40af'

  // ── Helpers ──
  function drawLine() {
    const y = doc.y
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).lineWidth(0.5).strokeColor('#cbd5e1').stroke()
    doc.y = y + 5
  }

  function heading(text: string) {
    if (doc.y > doc.page.height - 100) doc.addPage()
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BLUE).text(text, 50)
    doc.fillColor('black')
    drawLine()
    doc.moveDown(0.2)
  }

  function kvRow(label: string, value: string, color?: string) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155')
    doc.text(label, 60, doc.y, { continued: true, width: 200 })
    doc.font('Helvetica').fillColor(color || '#0f172a')
    doc.text(value)
    doc.fillColor('black')
  }

  // ── Title ──
  doc.font('Helvetica-Bold').fontSize(20).fillColor(BLUE)
  doc.text(program.program_name, 50, 50)
  doc.font('Helvetica').fontSize(11).fillColor(GREY)
  doc.text(`Selection Report  |  ${program.program_code}  |  AY ${program.academic_year}`)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`)
  doc.fillColor('black')
  doc.moveDown(1)
  drawLine()

  // ── 1. Summary ──
  heading('1. Program Summary')
  kvRow('Program:  ', `${program.program_name} (${program.program_code})`)
  kvRow('Academic Year:  ', program.academic_year || 'N/A')
  kvRow('Total Applications:  ', String(totalApps))
  kvRow('Approved:  ', String(approved.length), GREEN)
  kvRow('Waitlisted:  ', String(waitlisted.length))
  kvRow('Rejected:  ', String(rejected.length), RED)
  kvRow('Anomaly-Flagged:  ', String(anomalyCount), RED)

  // ── 2. Approved ──
  heading(`2. Approved Students (${approved.length})`)
  if (approved.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(GREY).text('No approved applications.', 60)
  } else {
    for (let i = 0; i < approved.length; i++) {
      const a = approved[i]!
      if (doc.y > doc.page.height - 80) doc.addPage()
      doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN)
      doc.text(`${i + 1}. ${a.user.full_name}`, 60)
      doc.font('Helvetica').fontSize(9).fillColor(GREY)
      doc.text(`Score: ${Number(a.composite_score || 0).toFixed(1)}  |  Verified: ${Number(a.post_verify_composite || 0).toFixed(1)}  |  ${a.user.email}`, 75)
      doc.fillColor('black')
      doc.moveDown(0.2)
    }
  }

  // ── 3. Waitlisted ──
  if (waitlisted.length > 0) {
    heading(`3. Waitlisted Students (${waitlisted.length})`)
    for (let i = 0; i < waitlisted.length; i++) {
      const a = waitlisted[i]!
      if (doc.y > doc.page.height - 80) doc.addPage()
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#b45309')
      doc.text(`${i + 1}. ${a.user.full_name}`, 60)
      doc.font('Helvetica').fontSize(9).fillColor(GREY)
      doc.text(`Score: ${Number(a.composite_score || 0).toFixed(1)}  |  ${a.user.email}`, 75)
      doc.fillColor('black')
      doc.moveDown(0.2)
    }
  }

  // ── 4. Rejected ──
  heading(`4. Rejected Students (${rejected.length})`)
  if (rejected.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(GREY).text('No rejections on record.', 60)
  } else {
    for (const a of rejected) {
      if (doc.y > doc.page.height - 70) doc.addPage()
      doc.font('Helvetica-Bold').fontSize(10).fillColor(RED)
      doc.text(a.user.full_name, 60)
      doc.font('Helvetica').fontSize(9).fillColor(GREY)
      const score = a.composite_score != null ? `Score: ${Number(a.composite_score).toFixed(1)}  |  ` : ''
      doc.text(`${score}${a.user.email}`, 75)
      if (a.rejection_reason) {
        doc.fontSize(8).fillColor('#78716c')
        doc.text(`Reason: ${a.rejection_reason.substring(0, 150)}`, 75)
      }
      doc.fillColor('black')
      doc.moveDown(0.2)
    }
  }

  // ── Footer on last page ──
  doc.moveDown(2)
  drawLine()
  doc.font('Helvetica').fontSize(8).fillColor(GREY)
  doc.text(`${program.program_name}  |  Confidential  |  ${new Date().toISOString()}`, { align: 'center' })

  doc.end()
  await pdfDone

  const pdfBuffer = Buffer.concat(chunks)
  await minioClient.putObject(BUCKET, objectKey, pdfBuffer, pdfBuffer.length, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="selection_report_${program.program_code}.pdf"`,
  })

  logger.info(`PDF report uploaded to MinIO: ${objectKey} (${pdfBuffer.length} bytes)`)
  return objectKey
}
