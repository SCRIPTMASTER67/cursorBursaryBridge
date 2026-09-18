import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiAdmin, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { destroyAllSessions } from '@/lib/auth/session';
import { audit } from '@/services/audit';
import {
  forcePasswordResetSchema,
  reactivateAccountSchema,
  suspendAccountSchema,
} from '@/lib/validation/admin';

const actionSchema = z.object({
  action: z.enum(['SUSPEND', 'REACTIVATE', 'FORCE_PASSWORD_RESET']),
  reason: z.string(),
});

/**
 * Account-level admin actions.
 *
 * Each one records the reason in the audit log, because a suspension without a
 * stated cause cannot be reviewed afterwards. An administrator cannot act on
 * their own account, which stops someone locking themselves out and keeps the
 * action reviewable by a second person.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiAdmin();
  if (!auth.ok) return auth.response;

  const ip = clientIp(request);
  // These change who can sign in, so they are rate limited like the other
  // authentication-adjacent endpoints.
  const limit = rateLimit(`admin:user-action:${auth.adminUserId}`, 30, 300);
  if (!limit.allowed) {
    return apiError(`Too many changes. Try again in ${limit.retryAfterSeconds} seconds.`, 429);
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid request.', 422, zodFields(parsed.error));

  const shape =
    parsed.data.action === 'SUSPEND'
      ? suspendAccountSchema
      : parsed.data.action === 'REACTIVATE'
        ? reactivateAccountSchema
        : forcePasswordResetSchema;
  const reasonParsed = shape.safeParse({ reason: parsed.data.reason });
  if (!reasonParsed.success) {
    return apiError('Please give a reason.', 422, zodFields(reasonParsed.error));
  }
  const { reason } = reasonParsed.data;

  if (id === auth.adminUserId) {
    return apiError('You cannot apply this action to your own account.', 422);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!user) return apiError('Account not found.', 404);

  if (parsed.data.action === 'SUSPEND') {
    if (user.status === 'SUSPENDED') return apiError('That account is already suspended.', 422);
    await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
    // Signing them out immediately; getCurrentUser would also reject them, but
    // clearing the rows means nothing is left to replay.
    await destroyAllSessions(id);
    await audit({
      userId: auth.adminUserId,
      action: 'admin.user_suspended',
      entityType: 'User',
      entityId: id,
      metadata: { reason, subjectEmail: user.email, subjectRole: user.role },
      ipAddress: ip,
    });
    return apiOk({ ok: true, status: 'SUSPENDED' });
  }

  if (parsed.data.action === 'REACTIVATE') {
    if (user.status === 'ACTIVE') return apiError('That account is already active.', 422);
    await prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
    await audit({
      userId: auth.adminUserId,
      action: 'admin.user_reactivated',
      entityType: 'User',
      entityId: id,
      metadata: { reason, subjectEmail: user.email },
      ipAddress: ip,
    });
    return apiOk({ ok: true, status: 'ACTIVE' });
  }

  // FORCE_PASSWORD_RESET. The flag is what the sign-in flow reads; ending the
  // sessions is what makes it take effect now rather than in fourteen days.
  await prisma.user.update({ where: { id }, data: { mustResetPassword: true } });
  await destroyAllSessions(id);
  await audit({
    userId: auth.adminUserId,
    action: 'admin.user_password_reset_forced',
    entityType: 'User',
    entityId: id,
    metadata: { reason, subjectEmail: user.email },
    ipAddress: ip,
  });
  return apiOk({ ok: true, mustResetPassword: true });
}
