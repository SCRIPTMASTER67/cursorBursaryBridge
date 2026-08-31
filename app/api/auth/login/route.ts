import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, zodFields } from '@/lib/auth/api';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, homePathForRole } from '@/lib/auth/session';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { loginSchema } from '@/lib/validation/auth';
import { audit } from '@/services/audit';

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const body = await request.json().catch(() => null);
  if (!body) return apiError('Invalid request.');

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
  }

  // Throttled per IP *and* per account, so neither a single address nor a
  // single mailbox can be brute-forced.
  const ipLimit = rateLimit(`login:ip:${ip}`, 10, 300);
  const accountLimit = rateLimit(`login:acct:${parsed.data.email}`, 6, 300);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    const retry = Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds);
    return apiError(`Too many sign-in attempts. Please try again in ${retry} seconds.`, 429);
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, role: true },
  });

  // Identical response for an unknown email and a wrong password, so the
  // endpoint cannot be used to enumerate registered addresses.
  const invalid = () => apiError('Email address or password is incorrect.', 401);

  if (!user) {
    await verifyPassword(parsed.data.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
    return invalid();
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    await audit({ userId: user.id, action: 'auth.login_failed', entityType: 'User', entityId: user.id, ipAddress: ip });
    return invalid();
  }

  await createSession(user.id, { userAgent: request.headers.get('user-agent'), ipAddress: ip });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ userId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, ipAddress: ip });

  return apiOk({ ok: true, redirectTo: await landingPath(user.id, user.role) });
}

/**
 * Send the user where they can actually act: mid-onboarding users resume where
 * they stopped, everyone else lands on their dashboard.
 */
async function landingPath(userId: string, role: 'STUDENT' | 'CORPORATE'): Promise<string> {
  if (role === 'STUDENT') {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { onboardingCompletedAt: true, onboardingStep: true },
    });
    if (profile && !profile.onboardingCompletedAt) return `/onboarding/student/${profile.onboardingStep}`;
  } else {
    const profile = await prisma.corporateProfile.findUnique({
      where: { userId },
      select: { onboardingCompletedAt: true, onboardingStep: true },
    });
    if (profile && !profile.onboardingCompletedAt) return `/onboarding/organisation/${profile.onboardingStep}`;
  }
  return homePathForRole(role);
}
