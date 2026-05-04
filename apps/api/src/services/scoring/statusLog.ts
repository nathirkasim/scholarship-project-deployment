import { prisma } from '../../lib/prisma'

export async function logStatusChange(
  applicationId: string,
  from: string | undefined,
  to: string,
  changedById?: string,
  reason?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.applicationStatusLog.create({
    data: {
      application_id: applicationId,
      from_status: from as any,
      to_status: to as any,
      changed_by_id: changedById,
      reason,
      metadata: metadata as any,
    },
  })
}
