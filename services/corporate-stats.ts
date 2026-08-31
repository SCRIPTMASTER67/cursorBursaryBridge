import 'server-only';
import { prisma } from '@/lib/db';

export type CorporateStats = {
  activeProgrammes: number;
  totalApplications: number;
  eligibleApplications: number;
  shortlisted: number;
  selected: number;
};

/**
 * Dashboard counters, computed in PostgreSQL.
 *
 * Every figure is scoped by organisationId, which is what stops one funder
 * seeing another's pipeline. "Eligible" reads the EligibilityService verdict
 * recorded when the application was submitted, so it reflects the funder's
 * actual rules rather than being inferred from the match score.
 */
export async function getCorporateStats(organisationId: string): Promise<CorporateStats> {
  const [activeProgrammes, totalApplications, eligibleApplications, shortlisted, selected] =
    await Promise.all([
      prisma.fundingProgramme.count({ where: { organisationId, status: 'PUBLISHED' } }),
      prisma.application.count({ where: { organisationId, status: { not: 'DRAFT' } } }),
      prisma.application.count({
        where: { organisationId, status: { not: 'DRAFT' }, eligibilityOutcome: 'ELIGIBLE' },
      }),
      prisma.shortlist.count({ where: { organisationId, status: 'SHORTLISTED' } }),
      prisma.shortlist.count({ where: { organisationId, status: 'SELECTED' } }),
    ]);

  return { activeProgrammes, totalApplications, eligibleApplications, shortlisted, selected };
}

export type ProgrammeSummaryRow = {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  closingDate: Date;
  applicationCount: number;
  eligibleCount: number;
  shortlistCount: number;
  intakeTarget: number | null;
};

/** Per-programme counts for the dashboard and the Programmes page. */
export async function getProgrammeSummaries(organisationId: string): Promise<ProgrammeSummaryRow[]> {
  const programmes = await prisma.fundingProgramme.findMany({
    where: { organisationId },
    select: {
      id: true,
      name: true,
      status: true,
      closingDate: true,
      intakeTarget: true,
      _count: { select: { applications: true, shortlists: true } },
    },
    orderBy: [{ status: 'asc' }, { closingDate: 'asc' }],
  });

  // One grouped query rather than a count per programme.
  const eligibleCounts = await prisma.application.groupBy({
    by: ['fundingProgrammeId'],
    where: { organisationId, status: { not: 'DRAFT' }, eligibilityOutcome: 'ELIGIBLE' },
    _count: { _all: true },
  });
  const eligibleByProgramme = new Map(
    eligibleCounts.map((row) => [row.fundingProgrammeId, row._count._all]),
  );

  return programmes.map((programme) => ({
    id: programme.id,
    name: programme.name,
    status: programme.status,
    closingDate: programme.closingDate,
    applicationCount: programme._count.applications,
    eligibleCount: eligibleByProgramme.get(programme.id) ?? 0,
    shortlistCount: programme._count.shortlists,
    intakeTarget: programme.intakeTarget,
  }));
}

/** Recent activity feed, assembled from applications and shortlist entries. */
export async function getRecentActivity(organisationId: string, limit = 6) {
  const [applications, shortlists] = await Promise.all([
    prisma.application.findMany({
      where: { organisationId, status: { not: 'DRAFT' }, submittedAt: { not: null } },
      select: {
        id: true,
        submittedAt: true,
        fundingProgramme: { select: { name: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: limit,
    }),
    prisma.shortlist.findMany({
      where: { organisationId },
      select: {
        id: true,
        addedAt: true,
        status: true,
        fundingProgramme: { select: { name: true } },
      },
      orderBy: { addedAt: 'desc' },
      take: limit,
    }),
  ]);

  type Activity = { id: string; at: Date; label: string; detail: string };

  const events: Activity[] = [
    ...applications.map((application) => ({
      id: `app-${application.id}`,
      at: application.submittedAt!,
      label: 'New application received',
      detail: application.fundingProgramme.name,
    })),
    ...shortlists.map((entry) => ({
      id: `sl-${entry.id}`,
      at: entry.addedAt,
      label: entry.status === 'SELECTED' ? 'Applicant selected' : 'Applicant shortlisted',
      detail: entry.fundingProgramme.name,
    })),
  ];

  return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
