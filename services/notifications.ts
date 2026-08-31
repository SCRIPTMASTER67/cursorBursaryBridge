import 'server-only';
import type { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
};

/**
 * Persist an in-app notification and, when the user has opted in, mirror it to
 * email. Every product event goes through here so the notification surface has
 * exactly one implementation.
 */
export async function notify(input: CreateNotificationInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, emailNotifications: true, firstName: true },
  });
  if (!user) return;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });

  if (!user.emailNotifications) return;

  const { sent } = await sendEmail({
    to: user.email,
    subject: input.title,
    heading: `Hi ${user.firstName},`,
    body: input.body,
    actionLabel: input.link ? 'View in Bursary-Bridge' : undefined,
    actionUrl: input.link ? `${env.NEXT_PUBLIC_APP_URL}${input.link}` : undefined,
  });

  if (sent) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { emailSentAt: new Date() },
    });
  }
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
