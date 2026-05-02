import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import { PrismaClient } from '@prisma/client'
import { runTOPSIS } from '../services/scoring/ruleEngine'

const prisma = new PrismaClient()

async function main() {
  const program = await prisma.scholarshipProgram.findFirst({
    where: { is_active: true }, orderBy: { created_at: 'desc' },
  })
  if (!program) { console.error('No active program'); process.exit(1) }

  console.log(`Re-running TOPSIS for: ${program.program_name}`)
  await runTOPSIS(program.id)

  const top10 = await prisma.application.findMany({
    where:   { program_id: program.id, composite_score: { not: null } },
    orderBy: { composite_rank: { sort: 'asc', nulls: 'last' } },
    take:    10,
    include: { user: { select: { full_name: true } } },
  })

  console.log('\n  Rank  Name                      Composite  Merit   Need')
  console.log('  ' + '─'.repeat(62))
  for (const a of top10) {
    const rank  = String(a.composite_rank ?? '—').padStart(4)
    const name  = (a.user.full_name).padEnd(24)
    const comp  = Number(a.composite_score ?? 0).toFixed(2).padStart(9)
    const merit = Number(a.merit_score ?? 0).toFixed(1).padStart(7)
    const need  = Number(a.rule_need_score ?? 0).toFixed(1).padStart(7)
    console.log(`  ${rank}  ${name} ${comp}  ${merit}  ${need}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
