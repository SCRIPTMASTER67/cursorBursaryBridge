import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ProgrammeActions } from '@/components/corporate/programme-actions';
import { Badge, ProgrammeStatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, StatCard } from '@/components/ui/card';
import { ChevronRight, Edit } from '@/components/icons';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import {
  citizenshipLabels,
  documentTypeLabels,
  fundingCoverageLabels,
  fundingTypeLabels,
  incomeBandLabels,
  provinceLabels,
  qualificationLabels,
} from '@/lib/labels';
import { deadlineLabel, formatDate, formatNumber } from '@/lib/utils';
import { getApplicantCounts } from '@/services/applicants';

export const metadata: Metadata = { title: 'Programme' };

export default async function ProgrammeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organisationId } = await requireCorporate();

  // Scoped by organisationId — another funder's programme returns 404.
  const programme = await prisma.fundingProgramme.findFirst({
    where: { id, organisationId },
    include: {
      eligibility: true,
      questions: { orderBy: { order: 'asc' } },
      supportedInstitutions: { include: { institution: { select: { name: true } } } },
      supportedProgrammes: { include: { programme: { select: { name: true } } } },
    },
  });

  if (!programme) notFound();

  const counts = await getApplicantCounts(organisationId, programme.id);
  const eligibility = programme.eligibility;

  return (
    <PageBody>
      <PageHeader
        title={programme.name}
        description={programme.shortDescription}
        breadcrumb={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-ink-400">
            <Link href="/corporate/programmes" className="hover:text-ink-600">
              Programmes
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="truncate text-ink-600">{programme.name}</span>
          </nav>
        }
        actions={
          <>
            <ButtonLink
              href={`/corporate/programmes/${programme.id}/edit`}
              variant="outline"
              leadingIcon={<Edit className="h-4 w-4" />}
            >
              Edit
            </ButtonLink>
            <ProgrammeActions programmeId={programme.id} status={programme.status} />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <ProgrammeStatusBadge status={programme.status} />
        <Badge tone="neutral">{fundingTypeLabels[programme.fundingType]}</Badge>
        <Badge tone="neutral">
          Closes {formatDate(programme.closingDate)} · {deadlineLabel(programme.closingDate)}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard value={formatNumber(counts.total)} label="Applications" accent="info" />
        <StatCard value={formatNumber(counts.eligible)} label="Eligible" accent="success" />
        <StatCard value={formatNumber(counts.shortlisted)} label="Shortlisted" accent="warning" />
        <StatCard value={formatNumber(counts.selected)} label="Selected" accent="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start [&>*]:min-w-0">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Description" />
            <p className="whitespace-pre-line px-6 pb-6 text-[13px] leading-6 text-ink-500">
              {programme.fullDescription}
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Eligibility criteria"
              description="These rules decide who matches this programme and who shows as eligible."
            />
            <dl className="divide-y divide-line px-6 pb-6">
              <Requirement
                label="Supported institutions"
                value={
                  programme.supportedInstitutions.length === 0
                    ? 'All institutions'
                    : programme.supportedInstitutions.map((i) => i.institution.name).join(', ')
                }
              />
              <Requirement
                label="Supported courses"
                value={
                  programme.supportedProgrammes.length === 0
                    ? 'All courses'
                    : programme.supportedProgrammes.map((p) => p.programme.name).join(', ')
                }
              />
              <Requirement
                label="Qualification level"
                value={
                  eligibility && eligibility.qualificationLevels.length > 0
                    ? eligibility.qualificationLevels.map((q) => qualificationLabels[q]).join(', ')
                    : 'All levels'
                }
              />
              <Requirement
                label="Minimum academic average"
                value={eligibility?.minAcademicAverage ? `${eligibility.minAcademicAverage}%` : 'No minimum'}
              />
              <Requirement
                label="Year of study"
                value={
                  eligibility && eligibility.yearsOfStudy.length > 0
                    ? eligibility.yearsOfStudy.map((y) => `Year ${y}`).join(', ')
                    : 'Any year'
                }
              />
              <Requirement
                label="Citizenship"
                value={
                  eligibility && eligibility.citizenship.length > 0
                    ? eligibility.citizenship.map((c) => citizenshipLabels[c]).join(', ')
                    : 'No requirement'
                }
              />
              <Requirement
                label="Financial requirement"
                value={
                  eligibility?.maxHouseholdIncome
                    ? `Household income up to ${incomeBandLabels[eligibility.maxHouseholdIncome]}`
                    : eligibility?.requiresFinancialNeed
                      ? 'Demonstrated financial need'
                      : 'No requirement'
                }
              />
              <Requirement
                label="Geographic requirement"
                value={
                  eligibility && eligibility.provinces.length > 0
                    ? eligibility.provinces.map((p) => provinceLabels[p]).join(', ')
                    : 'All provinces'
                }
              />
              {eligibility?.otherRequirements && (
                <Requirement label="Other requirements" value={eligibility.otherRequirements} />
              )}
            </dl>
          </Card>

          {programme.questions.length > 0 && (
            <Card>
              <CardHeader title="Application questions" />
              <ol className="space-y-3 px-6 pb-6">
                {programme.questions.map((question, index) => (
                  <li key={question.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-600">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink-700">
                        {question.label}
                        {question.required && <span className="ml-1.5 text-danger-600">*</span>}
                      </span>
                      {question.helpText && (
                        <span className="mt-0.5 block text-xs text-ink-400">{question.helpText}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Funding provided</h2>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {programme.coverage.map((coverage) => (
                <li key={coverage}>
                  <Badge tone="brand">{fundingCoverageLabels[coverage]}</Badge>
                </li>
              ))}
            </ul>
            {programme.intakeTarget && (
              <p className="mt-4 text-[13px] text-ink-400">
                Target intake: {programme.intakeTarget} awards
              </p>
            )}
          </Card>

          {eligibility && eligibility.requiredDocuments.length > 0 && (
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold text-ink">Required documents</h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {eligibility.requiredDocuments.map((type) => (
                  <li key={type}>
                    <Badge tone="neutral">{documentTypeLabels[type]}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Applicants</h2>
            <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
              Review, shortlist and select applicants for this programme.
            </p>
            <ButtonLink
              href={`/corporate/applications?programme=${programme.id}`}
              fullWidth
              className="mt-4"
            >
              View {formatNumber(counts.total)} applications
            </ButtonLink>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}

function Requirement({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
      <dt className="w-52 shrink-0 text-[13px] font-medium text-ink-700">{label}</dt>
      <dd className="text-[13px] leading-6 text-ink-500">{value}</dd>
    </div>
  );
}
