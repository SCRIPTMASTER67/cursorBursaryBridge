import type { NextRequest } from 'next/server';
import { apiError, apiOk, apiUser } from '@/lib/auth/api';
import { markAllNotificationsRead, markNotificationRead } from '@/services/notifications';

/**
 * Mark one notification, or all of them, as read.
 *
 * Shared by both roles — notifications belong to a user, not to a role — and
 * scoped to the caller, so nobody can mark someone else's as read.
 */
export async function POST(request: NextRequest) {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { id?: string; all?: boolean } | null;
  if (!body) return apiError('Invalid request.');

  if (body.all) {
    await markAllNotificationsRead(auth.user.id);
    return apiOk({ ok: true });
  }

  if (!body.id) return apiError('A notification id is required.');
  await markNotificationRead(auth.user.id, body.id);
  return apiOk({ ok: true });
}
