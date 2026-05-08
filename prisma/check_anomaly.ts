import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check all apps with anomaly data
  const allApps = await prisma.application.findMany({
    where: { status: { notIn: ['draft'] } },
    select: {
      id: true, status: true, anomaly_score: true, anomaly_flag: true, anomaly_reasons: true,
      user: { select: { full_name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 30,
  })

  console.log('\n=== ALL EVALUATED APPLICATIONS ===')
  for (const app of allApps) {
    const reasons = (app.anomaly_reasons as any) ?? {}
    console.log(
      `${app.user.full_name.padEnd(25)} | Status: ${app.status.padEnd(22)} | ` +
      `Flag: ${String(app.anomaly_flag).padEnd(5)} | ` +
      `Score: ${app.anomaly_score != null ? Number(app.anomaly_score).toFixed(3) : 'null'.padEnd(5)} | ` +
      `G-rules: [${(reasons.g_rules_fired ?? []).join(',')}] | ` +
      `ML flag: ${reasons.ml_flag ?? false} | ML ran: ${reasons.ml_ran ?? 'N/A'}`
    )
  }

  // Counts
  const totalFlagged = await prisma.application.count({ where: { anomaly_flag: true } })
  const withNonZeroScore = await prisma.application.count({ where: { anomaly_score: { gt: 0 } } })
  const withNullScore = await prisma.application.count({ where: { anomaly_score: null, status: { notIn: ['draft'] } } })
  const withZeroScore = await prisma.application.count({ where: { anomaly_score: { equals: 0 } } })
  const total = await prisma.application.count({ where: { status: { notIn: ['draft'] } } })

  console.log('\n=== SUMMARY ===')
  console.log(`Total non-draft apps:   ${total}`)
  console.log(`Anomaly flagged:        ${totalFlagged}`)
  console.log(`Score > 0:              ${withNonZeroScore}`)
  console.log(`Score = 0.000:          ${withZeroScore}`)
  console.log(`Score = null:           ${withNullScore}`)
}

main().then(() => prisma.$disconnect())
