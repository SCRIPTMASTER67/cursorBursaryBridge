import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User, UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { env, isProduction } from '@/lib/env';

export const SESSION_COOKIE = 'bb_session';
const SESSION_TTL_DAYS = 14;

/**
 * Session tokens are random 32-byte values handed to the browser. Only their
 * SHA-256 hash is persisted, so a database dump cannot be replayed as a login.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(`${token}${env.AUTH_SECRET}`).digest('hex');
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Constant-time comparison used for one-off verification tokens. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Invalidate every session for a user (e.g. after a password change). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export type SessionUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'role'
  | 'status'
  | 'mustResetPassword'
  | 'firstName'
  | 'lastName'
  | 'mobile'
  | 'emailVerifiedAt'
  | 'emailNotifications'
>;

/**
 * Resolve the signed-in user for the current request.
 * `cache` de-duplicates the lookup across every component in one render pass.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          mustResetPassword: true,
          firstName: true,
          lastName: true,
          mobile: true,
          emailVerifiedAt: true,
          emailNotifications: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    return null;
  }

  // A suspended account is treated exactly like a signed-out one, and every
  // session it holds is destroyed rather than only the one presented. Doing it
  // here means suspension takes effect across every page, route handler and
  // role at once, instead of relying on each caller to remember to check.
  if (session.user.status === 'SUSPENDED') {
    await prisma.session.deleteMany({ where: { userId: session.user.id } });
    return null;
  }

  return session.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Guard for a specific role; sends the wrong role to its own dashboard. */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) {
    redirect(homePathForRole(user.role));
  }
  return user;
}

/**
 * Where a role belongs when it has no more specific destination.
 *
 * Written as an exhaustive switch rather than a ternary so that adding a
 * fourth role is a compile error here instead of a silent redirect to the
 * wrong portal.
 */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case 'STUDENT':
      return '/student/dashboard';
    case 'CORPORATE':
      return '/corporate/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
  }
}

export { hashToken };
