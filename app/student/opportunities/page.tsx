import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { OpportunitiesBrowser } from '@/components/student/opportunities-browser';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getCatalog } from '@/services/catalog';
import { getRankedOpportunities } from '@/services/matching';

export const metadata: Metadata = { title: 'Opportunities' };

/**
 * Every published opportunity, scored for this student.
 *
 * Scoring happens on the server; the browser receives a compact view model so
 * filtering and sorting stay instant without shipping the engine or the raw
 * programme rows to the client.
 */
export default async function OpportunitiesPage() {
  const { studentProfileId } = await requireOnboardedStudent();

  const [ranked, applications, catalog] = await Promise.all([
    getRankedOpportunities(studentProfileId),
    prisma.application.findMany({
      where: { studentProfileId },
      select: { fundingProgrammeId: true, status: true },
    }),
    getCatalog(),
  ]);

  const appliedIds = new Set(applications.map((a) => a.fundingProgrammeId));

  const items = ranked.map((entry) => ({
    id: entry.programme.id,
    name: entry.programme.name,
    organisationName: entry.programme.organisation.name,
    shortDescription: entry.programme.shortDescription,
    fundingType: entry.programme.fundingType,
    coverage: entry.programme.coverage,
    closingDate: entry.programme.closingDate.toISOString(),
    courses: entry.programme.supportedProgrammes.map((p) => ({
      id: p.programme.id,
      name: p.programme.name,
    })),
    institutions: entry.programme.supportedInstitutions.map((i) => ({
      id: i.institution.id,
      name: i.institution.shortName ?? i.institution.name,
    })),
    qualificationLevels: entry.programme.eligibility?.qualificationLevels ?? [],
    provinces: entry.programme.eligibility?.provinces ?? [],
    matchScore: entry.match.matchScore,
    classification: entry.match.classification,
    reasons: entry.match.reasons,
    applied: appliedIds.has(entry.programme.id),
  }));

  return (
    <PageBody>
      <PageHeader
        title="Opportunities"
        description={`${items.length} funding opportunities are open right now, ranked by how well they match your profile.`}
      />
      <OpportunitiesBrowser items={items} catalog={catalog} />
    </PageBody>
  );
}
