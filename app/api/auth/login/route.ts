import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, zodFields } from '@/lib/auth/api';
import { verifyPassword } from '@/lib/auth/password';
import type { UserRole } from '@prisma/client';
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
    select: {
      id: true,
      passwordHash: true,
      role: true,
      status: true,
      mustResetPassword: true,
    },
  });

  // Identical response for an unknown email and a wrong password, so the
  // endpoint cannot be used to enumerate registered addresses.
  const invalid = () => apiError('Email address or password is incorrect.', 401);

  if (!user) {
    await verifyPassword(
      parsed.data.password,
      '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi',
    );
    return invalid();
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    await audit({
      userId: user.id,
      action: 'auth.login_failed',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });
    return invalid();
  }

  // Checked after the password, not before: a suspended account must not be
  // distinguishable from any other until the caller has proved they own it,
  // or this endpoint would tell an attacker which addresses are registered.
  // No session is created, so a suspended account cannot hold one at all.
  if (user.status === 'SUSPENDED') {
    await audit({
      userId: user.id,
      action: 'auth.login_suspended',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });
    return apiError(
      'This account has been suspended. Contact support if you believe this is a mistake.',
      403,
    );
  }

  // An administrator forced a reset, so the old password must not get them in
  // even though it verified. They are sent to the reset flow instead.
  if (user.mustResetPassword) {
    await audit({
      userId: user.id,
      action: 'auth.login_reset_required',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });
    return apiError(
      'Your password must be reset before you can sign in. Request a reset link to continue.',
      403,
      { form: 'PASSWORD_RESET_REQUIRED' },
    );
  }

  await createSession(user.id, { userAgent: request.headers.get('user-agent'), ipAddress: ip });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({
    userId: user.id,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    ipAddress: ip,
  });

  return apiOk({ ok: true, redirectTo: await landingPath(user.id, user.role) });
}

/**
 * Send the user where they can actually act: mid-onboarding users resume where
 * they stopped, everyone else lands on their dashboard.
 */
async function landingPath(userId: string, role: UserRole): Promise<string> {
  if (role === 'ADMIN') return homePathForRole(role);
  if (role === 'STUDENT') {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { onboardingCompletedAt: true, onboardingStep: true },
    });
    if (profile && !profile.onboardingCompletedAt)
      return `/onboarding/student/${profile.onboardingStep}`;
  } else {
    const profile = await prisma.corporateProfile.findUnique({
      where: { userId },
      select: { onboardingCompletedAt: true, onboardingStep: true },
    });
    if (profile && !profile.onboardingCompletedAt)
      return `/onboarding/organisation/${profile.onboardingStep}`;
  }
  return homePathForRole(role);
}
