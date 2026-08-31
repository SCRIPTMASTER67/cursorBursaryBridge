import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ApplicantsTable } from '@/components/corporate/applicants-table';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import type { ApplicationStatus, EligibilityOutcome } from '@prisma/client';
import { getApplicantCounts, getApplicants, DEFAULT_PAGE_SIZE } from '@/services/applicants';
import { getCatalog } from '@/services/catalog';

export const metadata: Metadata = { title: 'Applications' };

type SearchParams = Promise<{
  programme?: string;
  status?: string;
  q?: string;
  page?: string;
  institution?: string;
  course?: string;
  match?: string;
  eligibility?: string;
}>;

/**
 * The applicant list.
 *
 * Filters and paging are URL state handled on the server, so the browser only
 * ever receives one page of rows — a programme with thousands of applicants
 * still loads in constant time.
 */
export default async function CorporateApplicationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { organisationId } = await requireCorporate();
  const params = await searchParams;

  const validStatuses: ApplicationStatus[] = [
    'SUBMITTED',
    'UNDER_REVIEW',
    'DOCUMENTS_REQUIRED',
    'SHORTLISTED',
    'APPROVED',
    'UNSUCCESSFUL',
  ];
  const status = validStatuses.includes(params.status as ApplicationStatus)
    ? (params.status as ApplicationStatus)
    : undefined;

  const [programmes, catalog, counts, result] = await Promise.all([
    prisma.fundingProgramme.findMany({
      where: { organisationId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
    getCatalog(),
    getApplicantCounts(organisationId, params.programme),
    getApplicants(organisationId, {
      programmeId: params.programme,
      status,
      search: params.q,
      institutionId: params.institution,
      courseId: params.course,
      minMatchScore: params.match ? Number(params.match) : undefined,
      eligibility: (['ELIGIBLE', 'NOT_ELIGIBLE', 'PENDING_VERIFICATION'] as const).includes(
        params.eligibility as EligibilityOutcome,
      )
        ? (params.eligibility as EligibilityOutcome)
        : undefined,
      page: params.page ? Number(params.page) : 1,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
  ]);

  const activeProgramme = params.programme
    ? programmes.find((p) => p.id === params.programme)
    : undefined;

  return (
    <PageBody>
      <PageHeader
        title="Applications"
        description={
          activeProgramme
            ? activeProgramme.name
            : 'Every application submitted to your organisation’s programmes.'
        }
      />
      <ApplicantsTable
        rows={result.rows.map((row) => ({
          ...row,
          submittedAt: row.submittedAt?.toISOString() ?? null,
        }))}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        counts={counts}
        programmes={programmes}
        institutions={catalog.institutions.map((i) => ({ id: i.id, name: i.shortName ?? i.name }))}
        courses={catalog.programmes.map((p) => ({ id: p.id, name: p.name }))}
      />
    </PageBody>
  );
}
