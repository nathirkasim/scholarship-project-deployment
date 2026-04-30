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

  //  PDF Report 
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const pdfDone = new Promise<void>((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)
  })

  const BLUE   = '#1e40af'
  const GREEN  = '#15803d'
  const RED    = '#b91c1c'
  const GREY   = '#6b7280'
  const LIGHT  = '#f8fafc'

  // Header
  doc.rect(0, 0, doc.page.width, 80).fill(BLUE)
  doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
     .text(program.program_name, 50, 20, { width: doc.page.width - 100 })
  doc.fontSize(11).font('Helvetica')
     .text(`Selection Report    ${program.program_code}    AY ${program.academic_year}`, 50, 46)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, 50, 60)
  doc.fillColor('black').moveDown(2)

  // Section helper
  function sectionTitle(title: string) {
    doc.moveDown(0.5)
    doc.rect(50, doc.y, doc.page.width - 100, 22).fill(BLUE)
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
       .text(title, 58, doc.y - 16)
    doc.fillColor('black').moveDown(1)
  }

  function row(label: string, value: string | number, color?: string) {
    doc.fontSize(10).font('Helvetica-Bold').text(label + ':', 60, doc.y, { continued: true })
    doc.font('Helvetica').fillColor(color ?? 'black').text(' ' + value, { continued: false })
    doc.fillColor('black')
  }

  // 1  Summary
  sectionTitle('1. Program Summary')
  row('Program', `${program.program_name} (${program.program_code})`)
  row('Academic Year', program.academic_year ?? '')
  row('Total Applications', totalApps)
  row('Approved', `${approved.length}`, GREEN)
  row('Waitlisted', `${waitlisted.length}`)
  row('Rejected', `${rejected.length}`, RED)
  row('Anomaly-Flagged', `${anomalyCount}`, RED)

  // 2  Approved
  sectionTitle(`2. Approved Students (${approved.length})`)
  if (approved.length === 0) {
    doc.fontSize(10).font('Helvetica-Oblique').text('No approved applications.', 60)
  } else {
    for (let i = 0; i < approved.length; i++) {
      const a = approved[i]!
      if (doc.y > doc.page.height - 80) doc.addPage()
      doc.fontSize(10).font('Helvetica-Bold').fillColor(GREEN)
         .text(`#${i + 1}  ${a.user.full_name}`, 60, doc.y, { continued: true })
      doc.font('Helvetica').fillColor(GREY)
         .text(`   TOPSIS: ${Number(a.composite_score ?? 0).toFixed(3)}  |  Post-Verify: ${Number(a.post_verify_composite ?? 0).toFixed(3)}`, { continued: false })
      doc.fillColor('black').fontSize(9).text(`     ${a.user.email}`, 60)
    }
  }

  // 3  Waitlisted
  if (waitlisted.length > 0) {
    sectionTitle(`3. Waitlisted Students (${waitlisted.length})`)
    for (let i = 0; i < waitlisted.length; i++) {
      const a = waitlisted[i]!
      if (doc.y > doc.page.height - 80) doc.addPage()
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#b45309')
         .text(`#${i + 1}  ${a.user.full_name}`, 60, doc.y, { continued: true })
      doc.font('Helvetica').fillColor(GREY)
         .text(`   TOPSIS: ${Number(a.composite_score ?? 0).toFixed(3)}`, { continued: false })
      doc.fillColor('black')
    }
  }

  // 4  Rejected
  sectionTitle(`4. Rejected Students (${rejected.length})`)
  if (rejected.length === 0) {
    doc.fontSize(10).font('Helvetica-Oblique').text('No rejections on record.', 60)
  } else {
    for (const a of rejected) {
      if (doc.y > doc.page.height - 80) doc.addPage()
      doc.fontSize(10).font('Helvetica-Bold').fillColor(RED)
         .text(a.user.full_name, 60, doc.y, { continued: true })
      doc.font('Helvetica').fillColor(GREY)
         .text(`   TOPSIS: ${Number(a.composite_score ?? 0).toFixed(3)}`, { continued: false })
      doc.fillColor('black').fontSize(9)
      if (a.rejection_reason) {
        doc.text(`     Reason: ${a.rejection_reason.substring(0, 120)}`, 60)
      }
    }
  }

  // Footer
  doc.fontSize(8).fillColor(GREY)
     .text(
       `${program.program_name}  Confidential Selection Report  Generated ${new Date().toISOString()}`,
       50, doc.page.height - 30, { align: 'center', width: doc.page.width - 100 }
     )

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
