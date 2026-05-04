import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find the 30 most recently created application IDs to KEEP
  const keep = await prisma.application.findMany({
    select: { id: true },
    orderBy: { created_at: 'desc' },
    take: 30,
  })

  const keepIds = keep.map(a => a.id)
  console.log(`Keeping ${keepIds.length} most recent applications.`)

  // Find all application IDs that should be deleted
  const toDelete = await prisma.application.findMany({
    select: { id: true },
    where: { id: { notIn: keepIds } },
  })

  const deleteIds = toDelete.map(a => a.id)
  console.log(`Deleting ${deleteIds.length} old applications and their related records...`)

  if (deleteIds.length === 0) {
    console.log('Nothing to delete.')
    return
  }

  // 1. Find assignment IDs for these applications (needed to delete field reports)
  const assignments = await prisma.verificationAssignment.findMany({
    select: { id: true },
    where: { application_id: { in: deleteIds } },
  })
  const assignmentIds = assignments.map(a => a.id)

  // 2. Delete verifier field reports linked to those assignments
  if (assignmentIds.length > 0) {
    const { count: frCount } = await prisma.verifierFieldReport.deleteMany({
      where: { assignment_id: { in: assignmentIds } },
    })
    console.log(`  Deleted ${frCount} field reports`)
  }

  // 3. Delete verification assignments
  const { count: vaCount } = await prisma.verificationAssignment.deleteMany({
    where: { application_id: { in: deleteIds } },
  })
  console.log(`  Deleted ${vaCount} verification assignments`)

  // 4. Delete application status logs
  const { count: logCount } = await prisma.applicationStatusLog.deleteMany({
    where: { application_id: { in: deleteIds } },
  })
  console.log(`  Deleted ${logCount} status logs`)

  // 5. Delete documents
  const { count: docCount } = await prisma.document.deleteMany({
    where: { application_id: { in: deleteIds } },
  })
  console.log(`  Deleted ${docCount} documents`)

  // 6. Delete notifications tied to these applications (optional application_id FK)
  const { count: notifCount } = await prisma.notification.deleteMany({
    where: { application_id: { in: deleteIds } },
  })
  console.log(`  Deleted ${notifCount} notifications`)

  // 7. Finally delete the applications themselves
  const { count: appCount } = await prisma.application.deleteMany({
    where: { id: { in: deleteIds } },
  })
  console.log(`  Deleted ${appCount} applications`)

  console.log('\nDone. Verifying...')
  const remaining = await prisma.application.count()
  console.log(`Applications remaining in DB: ${remaining}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
