import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiError, apiOk, zodFields } from '@/lib/auth/api';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { issuePasswordReset } from '@/lib/auth/password-reset';
import { emailSchema } from '@/lib/validation/auth';
import { audit } from '@/services/audit';

const schema = z.object({ email: emailSchema });

/**
 * Request a password reset link.
 *
 * The response is the same whether or not the address is registered, so this
 * endpoint cannot be used to discover who holds an account — the same property
 * the sign-in endpoint already maintains.
 *
 * A suspended account is not sent a link. Resetting the password would not let
 * them back in, and sending one would confirm the address exists.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return apiError('Enter a valid email address.', 422, zodFields(parsed.error));

  const ipLimit = rateLimit(`forgot:ip:${ip}`, 10, 900);
  const accountLimit = rateLimit(`forgot:acct:${parsed.data.email}`, 3, 900);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    const retry = Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds);
    return apiError(`Too many requests. Please try again in ${retry} seconds.`, 429);
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, firstName: true, status: true },
  });

  if (user && user.status === 'ACTIVE') {
    await issuePasswordReset(user);
    await audit({
      userId: user.id,
      action: 'auth.password_reset_requested',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });
  }

  // Deliberately identical in every case.
  return apiOk({
    ok: true,
    message: 'If that address has an account, a reset link is on its way.',
  });
}
