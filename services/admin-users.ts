import 'server-only';
import type { AccountStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';

const PAGE_SIZE = 25;

export type AdminUserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  organisationName: string | null;
};

/**
 * Account list for the admin portal.
 *
 * Returns account-level fields only. It deliberately does not join to
 * documents, applications or answers: an administrator manages accounts, and
 * the existing scoping rules that keep a student's documents and a funder's
 * applicant data private are not relaxed for this screen.
 */
export async function listUsers(options: {
  query?: string;
  role?: UserRole;
  status?: AccountStatus;
  page?: number;
}): Promise<{ rows: AdminUserRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, options.page ?? 1);
  const q = options.query?.trim();

  const where = {
    ...(options.role ? { role: options.role } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        corporateProfile: { select: { organisation: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    rows: rows.map(({ corporateProfile, ...user }) => ({
      ...user,
      organisationName: corporateProfile?.organisation.name ?? null,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export type AdminUserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetail>>>;

/**
 * One account, with a profile summary and its live sessions.
 *
 * `Session` rows are deleted on logout and on expiry, so this is the set of
 * sessions the account currently holds, not a history. Login history comes
 * from the audit log instead, which is why the page shows both.
 */
export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      mobile: true,
      role: true,
      status: true,
      mustResetPassword: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      sessions: {
        select: { id: true, createdAt: true, expiresAt: true, userAgent: true, ipAddress: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      studentProfile: {
        select: {
          id: true,
          profileStrength: true,
          onboardingCompletedAt: true,
          province: true,
          city: true,
          _count: { select: { applications: true, studyPreferences: true, documents: true } },
        },
      },
      corporateProfile: {
        select: {
          id: true,
          onboardingCompletedAt: true,
          organisation: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });
  if (!user) return null;

  const recentActivity = await prisma.auditLog.findMany({
    where: { userId },
    select: { id: true, action: true, entityType: true, createdAt: true, ipAddress: true },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  return { ...user, recentActivity };
}
