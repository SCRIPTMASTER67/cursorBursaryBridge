import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { NotificationsView } from '@/components/shared/notifications-view';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';

export const metadata: Metadata = { title: 'Notifications' };

export default async function CorporateNotificationsPage() {
  const { user } = await requireCorporate();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <PageBody>
      <PageHeader title="Notifications" description="Updates about your programmes and applicants." />
      <NotificationsView
        notifications={notifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          link: notification.link,
          readAt: notification.readAt?.toISOString() ?? null,
          createdAt: notification.createdAt.toISOString(),
        }))}
      />
    </PageBody>
  );
}
