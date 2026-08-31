import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, apiUser } from '@/lib/auth/api';
import { generateToken } from '@/lib/auth/session';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`resend:${auth.user.id}`, 3, 300);
  if (!limit.allowed) {
    return apiError(`Please wait ${limit.retryAfterSeconds} seconds before requesting another email.`, 429);
  }

  if (auth.user.emailVerifiedAt) {
    return apiOk({ ok: true, alreadyVerified: true });
  }

  const token = generateToken();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

  await prisma.verificationToken.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, tokenHash, expiresAt },
    update: { tokenHash, expiresAt },
  });

  await sendEmail({
    to: auth.user.email,
    subject: 'Your new Bursary-Bridge verification link',
    heading: `Hi ${auth.user.firstName},`,
    body: 'Here is a fresh link to verify your email address. It expires in 24 hours.',
    actionLabel: 'Verify my email',
    actionUrl: `${env.NEXT_PUBLIC_APP_URL}/verify?token=${token}`,
  });

  void clientIp(request);
  return apiOk({ ok: true });
}
