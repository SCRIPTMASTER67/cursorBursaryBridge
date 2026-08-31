import 'server-only';
import type { ShortlistStatus } from '@prisma/client';
import { prisma } from '@/lib/db';

/** Shortlist or beneficiary rows for one organisation. */
export async function getShortlistRows(organisationId: string, statuses: ShortlistStatus[]) {
  const entries = await prisma.shortlist.findMany({
    where: { organisationId, status: { in: statuses } },
    include: {
      fundingProgramme: { select: { name: true } },
      application: {
        select: {
          id: true,
          matchScore: true,
          studentProfile: {
            select: {
              academicAverage: true,
              user: { select: { firstName: true, lastName: true } },
              currentInstitution: { select: { name: true, shortName: true } },
              currentProgramme: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ addedAt: 'desc' }],
  });

  return entries.map((entry) => ({
    applicationId: entry.applicationId,
    studentName: `${entry.application.studentProfile.user.firstName} ${entry.application.studentProfile.user.lastName}`,
    institution:
      entry.application.studentProfile.currentInstitution?.shortName ??
      entry.application.studentProfile.currentInstitution?.name ??
      null,
    programme: entry.application.studentProfile.currentProgramme?.name ?? null,
    academicAverage: entry.application.studentProfile.academicAverage,
    matchScore: entry.application.matchScore,
    status: entry.status,
    addedAt: (entry.selectedAt ?? entry.addedAt).toISOString(),
    programmeName: entry.fundingProgramme.name,
  }));
}
