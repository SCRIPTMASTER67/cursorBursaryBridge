'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { NotificationType } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Bell, Calendar, CheckCircle, Inbox, Sparkles } from '@/components/icons';
import { cn, formatDate } from '@/lib/utils';

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const icons: Record<NotificationType, React.ReactNode> = {
  NEW_MATCH: <Sparkles className="h-4 w-4" />,
  APPLICATION_SUBMITTED: <CheckCircle className="h-4 w-4" />,
  APPLICATION_STATUS_CHANGED: <Bell className="h-4 w-4" />,
  DEADLINE_APPROACHING: <Calendar className="h-4 w-4" />,
  INFORMATION_REQUESTED: <Inbox className="h-4 w-4" />,
  PROGRAMME_PUBLISHED: <Sparkles className="h-4 w-4" />,
  WELCOME: <Bell className="h-4 w-4" />,
};

/** Shared notification centre, used by both the student and corporate apps. */
export function NotificationsView({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = notifications.filter((n) => !n.readAt).length;

  async function markAll() {
    setBusy(true);
    try {
      await fetch('/api/student/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: string) {
    await fetch('/api/student/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'You are all caught up'}
        action={
          unread > 0 ? (
            <Button variant="outline" size="sm" onClick={markAll} loading={busy}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="No notifications yet"
          description="We’ll let you know about new matches, application updates and approaching deadlines."
        />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {notifications.map((notification) => {
            const content = (
              <div
                className={cn(
                  'flex gap-3.5 px-5 py-4 transition-colors',
                  !notification.readAt && 'bg-brand-50/40',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    notification.readAt ? 'bg-surface-subtle text-ink-400' : 'bg-brand-100 text-brand-600',
                  )}
                >
                  {icons[notification.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-ink">{notification.title}</p>
                    {!notification.readAt && <Badge tone="brand">New</Badge>}
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-ink-500">{notification.body}</p>
                  <p className="mt-1.5 text-xs text-ink-300">{formatDate(notification.createdAt)}</p>
                </div>
              </div>
            );

            return (
              <li key={notification.id}>
                {notification.link ? (
                  <Link
                    href={notification.link}
                    onClick={() => {
                      if (!notification.readAt) void markOne(notification.id);
                    }}
                    className="block hover:bg-surface-subtle"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
