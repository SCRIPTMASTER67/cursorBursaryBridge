import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk } from '@/lib/auth/api';
import { homePathForRole } from '@/lib/auth/session';
import { audit } from '@/services/audit';

/**
 * Consume an email-verification token. Tokens are single-use and expire after
 * 24 hours; only their hash is stored.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) return apiError('Verification link is missing its token.');

  const tokenHash = createHash('sha256').update(body.token).digest('hex');

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash },
    select: { id: true, expiresAt: true, user: { select: { id: true, role: true, emailVerifiedAt: true } } },
  });

  if (!record) {
    return apiError('That verification link is not valid. Request a new one below.', 400);
  }
  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.verificationToken.delete({ where: { id: record.id } });
    return apiError('That verification link has expired. Request a new one below.', 410);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.user.id }, data: { emailVerifiedAt: new Date() } }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);

  await audit({
    userId: record.user.id,
    action: 'auth.email_verified',
    entityType: 'User',
    entityId: record.user.id,
  });

  const redirectTo =
    record.user.role === 'STUDENT' ? '/onboarding/student/education' : homePathForRole(record.user.role);

  return apiOk({ ok: true, redirectTo });
}
