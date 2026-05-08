import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Fixing anomaly_score for existing applications ===\n')

  // Get all non-draft applications
  const apps = await prisma.application.findMany({
    where: { status: { notIn: ['draft'] } },
    select: { id: true, anomaly_score: true, anomaly_flag: true, anomaly_reasons: true },
  })

  let fixedCount = 0

  for (const app of apps) {
    const reasons = (app.anomaly_reasons as any) ?? {}
    const mlRan = reasons.ml_ran === true

    // If ml_ran is not explicitly true, ML never ran — set score to null
    if (!mlRan && app.anomaly_score != null) {
      const updatedReasons = {
        ...reasons,
        ml_ran: false,
      }

      await prisma.application.update({
        where: { id: app.id },
        data: {
          anomaly_score: null,
          anomaly_reasons: updatedReasons,
        },
      })
      fixedCount++
    }
  }

  console.log(`Fixed ${fixedCount} of ${apps.length} applications (set anomaly_score to null, added ml_ran: false)\n`)

  // Verify
  const afterFlagged = await prisma.application.count({ where: { anomaly_flag: true } })
  const afterNull = await prisma.application.count({ where: { anomaly_score: null, status: { notIn: ['draft'] } } })
  const afterNonNull = await prisma.application.count({ where: { anomaly_score: { not: null } } })

  console.log('=== After fix ===')
  console.log(`Anomaly flagged:     ${afterFlagged}`)
  console.log(`Score = null:        ${afterNull}  (ML didn't run)`)
  console.log(`Score = real value:  ${afterNonNull}  (ML ran)`)
}

main()
  .then(() => { console.log('\nDone!'); return prisma.$disconnect() })
  .catch((e) => { console.error(e); return prisma.$disconnect() })
