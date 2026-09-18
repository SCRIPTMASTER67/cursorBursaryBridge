import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiError, apiOk, zodFields } from '@/lib/auth/api';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { hashPassword } from '@/lib/auth/password';
import { findPasswordReset } from '@/lib/auth/password-reset';
import { destroyAllSessions } from '@/lib/auth/session';
import { passwordSchema } from '@/lib/validation/auth';
import { audit } from '@/services/audit';

const schema = z
  .object({
    token: z.string().min(1, 'This reset link is missing its token'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Consume a reset token and set a new password.
 *
 * Three things happen together, in one transaction: the new hash is written,
 * the token is destroyed so the link cannot be replayed, and the
 * mustResetPassword flag is cleared. Every session the account holds is then
 * ended, because whoever prompted the reset may be holding one.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limit = rateLimit(`reset:ip:${ip}`, 10, 900);
  if (!limit.allowed) {
    return apiError(
      `Too many attempts. Please try again in ${limit.retryAfterSeconds} seconds.`,
      429,
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
  }

  const lookup = await findPasswordReset(parsed.data.token);
  if (!lookup.ok) {
    return apiError(
      lookup.reason === 'expired'
        ? 'That reset link has expired. Request a new one below.'
        : 'That reset link is not valid. Request a new one below.',
      lookup.reason === 'expired' ? 410 : 400,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: lookup.userId },
    select: { id: true, status: true },
  });
  if (!user) return apiError('That reset link is not valid. Request a new one below.', 400);

  // A suspended account cannot be recovered with a reset; the suspension has
  // to be lifted by an administrator first.
  if (user.status === 'SUSPENDED') {
    return apiError(
      'This account has been suspended. Contact support if you believe this is a mistake.',
      403,
    );
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustResetPassword: false },
    }),
    prisma.passwordResetToken.delete({ where: { id: lookup.tokenId } }),
  ]);

  await destroyAllSessions(user.id);

  await audit({
    userId: user.id,
    action: 'auth.password_reset_completed',
    entityType: 'User',
    entityId: user.id,
    ipAddress: ip,
  });

  return apiOk({ ok: true, redirectTo: '/login' });
}
