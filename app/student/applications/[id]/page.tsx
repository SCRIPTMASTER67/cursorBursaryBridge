import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody } from '@/components/layout/app-shell';
import { SummarySections } from '@/components/student/summary-sections';
import { CriterionRow } from '@/components/student/match-explanation';
import { ApplicationStatusBadge, Badge, MatchBadge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ArrowLeft, Calendar, CheckCircle, FileText } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { documentTypeLabels } from '@/lib/labels';
import type { CriterionResult } from '@/lib/matching';
import { formatDate } from '@/lib/utils';
import { buildStudentSummary } from '@/services/student-summary';

export const metadata: Metadata = { title: 'Application' };

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
};

/** The status-tracking view for one of the student's own applications. */
export default async function ApplicationDetailPage({ params, searchParams }: Params) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const { studentProfileId } = await requireOnboardedStudent();

  // findFirst with the profile id in the WHERE clause is what enforces that a
  // student can only ever read their own applications.
  const application = await prisma.application.findFirst({
    where: { id, studentProfileId },
    include: {
      fundingProgramme: {
        include: {
          organisation: { select: { name: true } },
          eligibility: { select: { requiredDocuments: true } },
          questions: { orderBy: { order: 'asc' } },
        },
      },
      documents: { include: { document: { select: { type: true, fileName: true } } } },
    },
  });

  if (!application) notFound();

  const summary = await buildStudentSummary(studentProfileId);
  const criteria = (application.matchReasons as unknown as CriterionResult[] | null) ?? [];
  const answers = (application.answers as Record<string, string | string[]> | null) ?? {};

  const timeline = [
    { label: 'Application started', date: application.createdAt, done: true },
    { label: 'Submitted', date: application.submittedAt, done: Boolean(application.submittedAt) },
    {
      label: 'Under review by funder',
      date: application.status === 'UNDER_REVIEW' ? application.lastStatusChangeAt : null,
      done: ['UNDER_REVIEW', 'SHORTLISTED', 'APPROVED', 'UNSUCCESSFUL'].includes(application.status),
    },
    {
      label: 'Shortlisted',
      date: application.status === 'SHORTLISTED' ? application.lastStatusChangeAt : null,
      done: ['SHORTLISTED', 'APPROVED'].includes(application.status),
    },
    {
      label: 'Decision',
      date: application.decisionAt,
      done: ['APPROVED', 'UNSUCCESSFUL'].includes(application.status),
    },
  ];

  return (
    <PageBody>
      <Link
        href="/student/applications"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to my applications
      </Link>

      {submitted === '1' && (
        <Alert tone="success" title="Application submitted" className="mb-5">
          {application.fundingProgramme.organisation.name} has received your application. We’ll email
          you as soon as the status changes.
        </Alert>
      )}

      {application.status === 'DOCUMENTS_REQUIRED' && (
        <Alert tone="warning" title="The funder needs more information" className="mb-5">
          {application.reviewNotes ??
            'Please upload the outstanding documents from your Documents page so your application can continue.'}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
                  {application.fundingProgramme.name}
                </h1>
                <p className="mt-1.5 text-[13px] font-medium text-ink-500">
                  {application.fundingProgramme.organisation.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {application.matchScore !== null && (
                  <MatchBadge
                    score={application.matchScore}
                    classification={application.matchClassification ?? undefined}
                  />
                )}
                <ApplicationStatusBadge status={application.status} />
              </div>
            </div>

            <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
                  Date applied
                </dt>
                <dd className="mt-1 text-[13px] font-semibold text-ink">
                  {application.submittedAt ? formatDate(application.submittedAt) : 'Not submitted'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
                  Closing date
                </dt>
                <dd className="mt-1 text-[13px] font-semibold text-ink">
                  {formatDate(application.fundingProgramme.closingDate)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
                  Last update
                </dt>
                <dd className="mt-1 text-[13px] font-semibold text-ink">
                  {formatDate(application.lastStatusChangeAt ?? application.updatedAt)}
                </dd>
              </div>
            </dl>

            {application.status === 'DRAFT' && (
              <div className="mt-5 border-t border-line pt-5">
                <ButtonLink href={`/student/opportunities/${application.fundingProgrammeId}/apply`}>
                  Continue Application
                </ButtonLink>
              </div>
            )}
          </Card>

          {application.fundingProgramme.questions.length > 0 && (
            <Card>
              <CardHeader title="Your answers" description="What you told this funder." />
              <dl className="space-y-4 px-6 pb-6">
                {application.fundingProgramme.questions.map((question) => {
                  const value = answers[question.id];
                  return (
                    <div key={question.id}>
                      <dt className="text-[13px] font-medium text-ink-700">{question.label}</dt>
                      <dd className="mt-1 whitespace-pre-line text-[13px] leading-6 text-ink-500">
                        {value === undefined || value === ''
                          ? 'Not answered'
                          : Array.isArray(value)
                            ? value.join(', ')
                            : String(value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Profile sent with this application"
              description="Captured when you applied. Editing your profile does not change a submitted application."
            />
            <div className="px-6 pb-6">
              <SummarySections sections={summary} editLabel="View" />
            </div>
          </Card>
        </div>

        {/* --------------------------------------------------------- Sidebar */}
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Progress</h2>
            <ol className="mt-4 space-y-4">
              {timeline.map((entry, index) => (
                <li key={entry.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        entry.done ? 'bg-brand-600 text-white' : 'bg-line text-ink-300'
                      }`}
                    >
                      {entry.done ? (
                        <CheckCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>
                    {index < timeline.length - 1 && (
                      <span className={`mt-1 w-px flex-1 ${entry.done ? 'bg-brand-200' : 'bg-line'}`} />
                    )}
                  </div>
                  <div className="pb-1">
                    <p
                      className={`text-[13px] ${entry.done ? 'font-medium text-ink' : 'text-ink-400'}`}
                    >
                      {entry.label}
                    </p>
                    {entry.date && <p className="text-xs text-ink-400">{formatDate(entry.date)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {criteria.length > 0 && (
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold text-ink">Match at time of applying</h2>
              <ul className="mt-4 space-y-2.5">
                {criteria.map((criterion, index) => (
                  <CriterionRow key={`${criterion.key}-${index}`} criterion={criterion} />
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Documents</h2>
            {application.documents.length === 0 ? (
              <p className="mt-2.5 text-[13px] text-ink-400">No documents attached.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {application.documents.map((link) => (
                  <li key={link.documentId} className="flex items-start gap-2.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink-700">
                        {documentTypeLabels[link.document.type]}
                      </span>
                      <span className="block truncate text-xs text-ink-400">{link.document.fileName}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {application.fundingProgramme.eligibility &&
              application.fundingProgramme.eligibility.requiredDocuments.length > 0 && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
                    Required by this programme
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {application.fundingProgramme.eligibility.requiredDocuments.map((type) => (
                      <li key={type}>
                        <Badge tone="neutral">{documentTypeLabels[type]}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-2 text-[13px] text-ink-400">
              <Calendar className="h-4 w-4" />
              Applications close {formatDate(application.fundingProgramme.closingDate)}
            </p>
            <ButtonLink
              href={`/student/opportunities/${application.fundingProgrammeId}`}
              variant="outline"
              fullWidth
              className="mt-3.5"
            >
              View opportunity
            </ButtonLink>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
