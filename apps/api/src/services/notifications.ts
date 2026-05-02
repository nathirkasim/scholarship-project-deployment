import { prisma } from '../lib/prisma'

export async function sendNotification(
  userId: string,
  applicationId: string | null,
  type: string,
  title: string,
  message: string
): Promise<void> {
  await prisma.notification.create({
    data: { user_id: userId, application_id: applicationId, type, title, message },
  })
}
