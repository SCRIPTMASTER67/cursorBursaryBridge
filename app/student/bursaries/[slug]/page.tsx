import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody } from '@/components/layout/app-shell';
import { BursaryStatusBadge } from '@/components/student/bursaries/status-badge';
import { ApplicationFormPanel } from '@/components/student/bursaries/application-form-panel';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { OrgAvatar } from '@/components/ui/avatar';
import { ArrowLeft, Calendar, ExternalLink, ShieldCheck } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { getDirectoryEntry } from '@/services/bursary-directory';
import { STATUS_COPY, canApplyHere, isOpenNow } from '@/lib/bursary-status';
import {
  citizenshipLabels,
  documentTypeLabels,
  fundingCoverageLabels,
  fundingTypeLabels,
  incomeBandLabels,
  provinceLabels,
  qualificationLabels,
} from '@/lib/labels';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getDirectoryEntry(slug);
  return { title: entry?.name ?? 'Bursary' };
}

/**
 * One opportunity in full.
 *
 * Everything shown is what the record holds. A field the source did not state
 * reads "Not specified" rather than being filled in with something plausible,
 * and the source and the date it was last confirmed are always visible so a
 * student can check for themselves.
 */
export default async function BursaryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireOnboardedStudent();
  const { slug } = await params;
  const entry = await getDirectoryEntry(slug);
  if (!entry) notFound();

  const closed = entry.status === 'CLOSED';
  const applyHere = canApplyHere(entry.status, entry.origin);
  const eligibility = entry.eligibility;

  return (
    <PageBody>
      <Link
        href="/student/bursaries"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        All bursaries
      </Link>

      <div className="mb-5 flex flex-wrap items-start gap-4">
        <OrgAvatar name={entry.organisation.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold leading-tight text-ink">{entry.name}</h1>
            <BursaryStatusBadge status={entry.status} />
          </div>
          <p className="mt-1 text-sm text-ink-600">{entry.organisation.name}</p>
        </div>
      </div>

      {/* The status is stated in words as well as a badge, so it cannot be
          missed and cannot be mistaken for something else. */}
      <Alert
        tone={
          isOpenNow(entry.status)
            ? 'success'
            : entry.status === 'NEEDS_VERIFICATION'
              ? 'warning'
              : 'info'
        }
        className="mb-5"
      >
        <span className="font-semibold">{STATUS_COPY[entry.status].label}.</span>{' '}
        {STATUS_COPY[entry.status].meaning}
      </Alert>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="About this opportunity" />
            <CardBody>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">
                {entry.fullDescription || entry.shortDescription || 'Not specified.'}
              </p>
              {entry.sourceUrl && (
                <p className="mt-3 text-[13px] text-ink-500">
                  This summary is taken from the source. Read the full details on the{' '}
                  <Link
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-medium text-brand-600 underline"
                  >
                    original page
                  </Link>
                  .
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Funding and dates" />
            <CardBody className="grid gap-3.5 sm:grid-cols-2">
              <Fact label="Funding type" value={fundingTypeLabels[entry.fundingType]} />
              <Fact
                label="What it covers"
                value={
                  entry.coverage.length > 0
                    ? entry.coverage.map((c) => fundingCoverageLabels[c]).join(', ')
                    : null
                }
              />
              <Fact
                label="Applications open"
                value={entry.openDate ? formatDate(entry.openDate) : null}
              />
              <Fact
                label="Closing date"
                value={
                  entry.deadlineKind === 'ROLLING'
                    ? 'Rolling applications — no fixed closing date'
                    : entry.deadlineKind === 'UNTIL_FILLED'
                      ? 'Open until all places are filled'
                      : entry.closingDate
                        ? formatDate(entry.closingDate)
                        : null
                }
                detail={entry.deadlineNote ?? undefined}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Eligibility"
              description="What the source states. This is not a check against your profile — see My Matches for that."
            />
            <CardBody className="grid gap-3.5 sm:grid-cols-2">
              <Fact
                label="Courses"
                value={
                  entry.supportedProgrammes.length > 0
                    ? entry.supportedProgrammes.map((p) => p.programme.name).join(', ')
                    : null
                }
              />
              <Fact
                label="Institutions"
                value={
                  entry.supportedInstitutions.length > 0
                    ? entry.supportedInstitutions
                        .map((i) => i.institution.shortName ?? i.institution.name)
                        .join(', ')
                    : null
                }
              />
              <Fact
                label="Qualification level"
                value={
                  eligibility?.qualificationLevels.length
                    ? eligibility.qualificationLevels.map((q) => qualificationLabels[q]).join(', ')
                    : null
                }
              />
              <Fact
                label="Academic requirement"
                value={
                  eligibility?.minAcademicAverage
                    ? `Minimum average of ${eligibility.minAcademicAverage}%`
                    : null
                }
              />
              <Fact
                label="Financial requirement"
                value={
                  eligibility?.maxHouseholdIncome
                    ? `Household income up to ${incomeBandLabels[eligibility.maxHouseholdIncome]}`
                    : eligibility?.requiresFinancialNeed
                      ? 'Financial need must be demonstrated'
                      : null
                }
              />
              <Fact
                label="Location"
                value={
                  eligibility?.provinces.length
                    ? eligibility.provinces.map((p) => provinceLabels[p]).join(', ')
                    : null
                }
              />
              <Fact
                label="Citizenship"
                value={
                  eligibility?.citizenship.length
                    ? eligibility.citizenship.map((c) => citizenshipLabels[c]).join(', ')
                    : null
                }
              />
              <Fact label="Other requirements" value={eligibility?.otherRequirements ?? null} />
              {eligibility?.requiredDocuments.length ? (
                <div className="sm:col-span-2">
                  <p className="text-[13px] font-medium text-ink-500">Documents required</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {eligibility.requiredDocuments.map((doc) => (
                      <Badge key={doc} tone="neutral">
                        {documentTypeLabels[doc]}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <ApplicationFormPanel
            forms={entry.applicationForms.map((form) => ({
              id: form.id,
              name: form.name,
              fileType: form.fileType,
              sizeBytes: form.sizeBytes,
              providedBy: form.providedBy,
              mirrored: form.storageKey !== null,
              fileUrl: form.fileUrl,
              sourceUrl: form.sourceUrl,
              lastVerifiedAt: form.lastVerifiedAt?.toISOString() ?? null,
            }))}
            applicationUrl={entry.applicationUrl}
            closed={closed}
          />
        </div>

        <aside className="grid gap-5 self-start">
          <Card>
            <CardHeader title="How to apply" />
            <CardBody className="grid gap-3">
              {closed ? (
                <>
                  <p className="text-sm text-ink-600">
                    Applications are closed for this cycle. This page stays available so you can see
                    what was required and be ready for the next one.
                  </p>
                  {entry.sourceUrl && (
                    <ButtonLink
                      href={entry.sourceUrl}
                      external
                      variant="outline"
                      trailingIcon={<ExternalLink className="h-4 w-4" />}
                    >
                      Visit source
                    </ButtonLink>
                  )}
                </>
              ) : applyHere ? (
                <ButtonLink href={`/student/opportunities/${entry.id}/apply`}>
                  Apply through Bursary-Bridge
                </ButtonLink>
              ) : (
                <>
                  <p className="text-sm text-ink-600">
                    {isOpenNow(entry.status)
                      ? 'This opportunity is applied for on the funder’s own site.'
                      : 'Check the source for how and when to apply.'}
                  </p>
                  {(entry.applicationUrl ?? entry.sourceUrl) && (
                    <ButtonLink
                      href={entry.applicationUrl ?? entry.sourceUrl!}
                      external
                      variant={isOpenNow(entry.status) ? 'primary' : 'outline'}
                      trailingIcon={<ExternalLink className="h-4 w-4" />}
                    >
                      {entry.applicationUrl ? 'Apply on the funder’s site' : 'Visit source'}
                    </ButtonLink>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Source" />
            <CardBody className="grid gap-3 text-[13px]">
              {entry.sources.length === 0 && !entry.sourceUrl ? (
                <p className="text-ink-500">No source recorded.</p>
              ) : (
                <>
                  {entry.origin === 'FIRST_PARTY' ? (
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
                      <p className="text-ink-700">
                        Published on Bursary-Bridge by {entry.organisation.name} themselves.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <ShieldCheck
                        className={
                          'mt-0.5 h-4 w-4 shrink-0 ' +
                          (entry.officialSource ? 'text-success-600' : 'text-ink-400')
                        }
                      />
                      <p className="text-ink-700">
                        {entry.officialSource
                          ? 'Official source: the funder’s own website.'
                          : `Listed by ${entry.sourceName ?? 'a publication'}, which is not the funder’s own site.`}
                      </p>
                    </div>
                  )}

                  {entry.sources.map((source) => (
                    <Link
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block truncate font-medium text-brand-600 underline"
                    >
                      {source.name}
                      {source.isPrimary ? ' (primary)' : ''}
                    </Link>
                  ))}
                  {entry.sources.length === 0 && entry.sourceUrl && (
                    <Link
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block truncate font-medium text-brand-600 underline"
                    >
                      View original opportunity
                    </Link>
                  )}
                </>
              )}

              <div className="flex items-start gap-2 border-t border-line pt-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                <p className="text-ink-600">
                  {entry.lastVerifiedAt ? (
                    <>Last verified: {formatDate(entry.lastVerifiedAt)}</>
                  ) : (
                    <>Not yet verified against its source.</>
                  )}
                  <br />
                  <span className="text-ink-500">
                    Bursary information changes. Check the source before you submit anything.
                  </span>
                </p>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </PageBody>
  );
}

/** A single stated fact. Unstated reads as unstated, never as something else. */
function Fact({ label, value, detail }: { label: string; value: string | null; detail?: string }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink-500">{label}</p>
      <p className={'mt-0.5 text-sm ' + (value ? 'text-ink' : 'italic text-ink-400')}>
        {value ?? 'Not specified'}
      </p>
      {detail && value !== detail && (
        <p className="mt-0.5 text-[13px] text-ink-500">Source wording: “{detail}”</p>
      )}
    </div>
  );
}
