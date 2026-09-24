import 'server-only';
import type { ShortlistStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { applicantSummary } from '@/lib/applicant-view';

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
              qualificationLevel: true,
              user: { select: { firstName: true, lastName: true, email: true } },
              currentInstitution: { select: { name: true, shortName: true } },
              currentProgramme: { select: { name: true } },
            },
          },
          externalApplicant: {
            select: {
              fullName: true,
              email: true,
              institutionName: true,
              programmeName: true,
              qualificationLevel: true,
              academicAverage: true,
            },
          },
        },
      },
    },
    orderBy: [{ addedAt: 'desc' }],
  });

  return entries.map((entry) => {
    const person = applicantSummary(entry.application);
    return {
      applicationId: entry.applicationId,
      studentName: person.fullName,
      institution: person.institution,
      programme: person.programme,
      academicAverage: person.academicAverage,
      matchScore: entry.application.matchScore,
      status: entry.status,
      addedAt: (entry.selectedAt ?? entry.addedAt).toISOString(),
      programmeName: entry.fundingProgramme.name,
      external: person.external,
    };
  });
}
