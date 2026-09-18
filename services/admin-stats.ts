import 'server-only';
import { prisma } from '@/lib/db';

export type AdminStats = {
  students: number;
  suspendedStudents: number;
  organisations: number;
  suspendedOrganisations: number;
  corporateUsers: number;
  publishedProgrammes: number;
  suspendedProgrammes: number;
  signupsThisWeek: number;
  applicationsByStatus: { status: string; count: number }[];
};

/**
 * Platform-wide counters, computed in PostgreSQL.
 *
 * Unlike the corporate dashboard these are deliberately unscoped: an
 * administrator sees totals across the platform. Nothing here recomputes a
 * match score or an eligibility verdict; the application counts read the
 * verdict already recorded at submission.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [
    students,
    suspendedStudents,
    organisations,
    suspendedOrganisations,
    corporateUsers,
    publishedProgrammes,
    suspendedProgrammes,
    signupsThisWeek,
    grouped,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'STUDENT', status: 'SUSPENDED' } }),
    prisma.organisation.count(),
    prisma.organisation.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { role: 'CORPORATE' } }),
    prisma.fundingProgramme.count({ where: { status: 'PUBLISHED' } }),
    prisma.fundingProgramme.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return {
    students,
    suspendedStudents,
    organisations,
    suspendedOrganisations,
    corporateUsers,
    publishedProgrammes,
    suspendedProgrammes,
    signupsThisWeek,
    applicationsByStatus: grouped
      .map((row) => ({ status: row.status as string, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}
