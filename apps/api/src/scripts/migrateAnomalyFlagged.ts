import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.application.updateMany({
    where:  { status: 'anomaly_flagged' },
    data:   { status: 'rejected', final_decision: 'rejected', decided_at: new Date() },
  })
  console.log(`Migrated ${result.count} anomaly_flagged → rejected`)

  const logResult = await prisma.applicationStatusLog.updateMany({
    where:  { to_status: 'anomaly_flagged' },
    data:   { to_status: 'rejected' },
  })
  console.log(`Status log updated: ${logResult.count} rows`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
