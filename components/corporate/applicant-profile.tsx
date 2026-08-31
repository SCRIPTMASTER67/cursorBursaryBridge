'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type {
  Achievement,
  ApplicationStatus,
  Citizenship,
  DocumentType,
  FundingNeed,
  FundingSituation,
  IncomeBand,
  MatchClassification,
  Province,
  QualificationLevel,
  TriState,
} from '@prisma/client';
import { CriterionRow } from '@/components/student/match-explanation';
import { ApplicationStatusBadge, EligibilityBadge, MatchBadge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Tabs } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Mail,
  MapPin,
  Phone,
} from '@/components/icons';
import {
  achievementLabels,
  citizenshipLabels,
  documentTypeLabels,
  fundingNeedLabels,
  fundingSituationLabels,
  incomeBandLabels,
  provinceLabels,
  qualificationLabels,
  triStateLabels,
} from '@/lib/labels';
import type { EligibilityResult } from '@/lib/matching';
import { formatDate } from '@/lib/utils';

type StudentView = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string | null;
  province: Province | null;
  city: string | null;
  institution: string | null;
  programme: string | null;
  qualificationLevel: QualificationLevel | null;
  yearOfStudy: number | null;
  academicAverage: number | null;
  achievements: Achievement[];
  householdIncome: IncomeBand | null;
  citizenship: Citizenship | null;
  firstGeneration: TriState | null;
  fundingNeeds: FundingNeed[];
  fundingSituation: FundingSituation | null;
  studyPreferences: { preferenceNumber: number; programme: string; institution: string }[];
};

/**
 * The applicant review screen.
 *
 * Eligibility is recomputed live against the programme's current rules, so a
 * reviewer always sees today's assessment — and every criterion is shown, not
 * just an overall verdict.
 */
export function ApplicantProfile({
  application,
  student,
  documents,
  eligibility,
  neighbours,
}: {
  application: {
    id: string;
    status: ApplicationStatus;
    matchScore: number | null;
    matchClassification: MatchClassification | null;
    submittedAt: string | null;
    reviewNotes: string | null;
    answers: Record<string, string | string[]>;
    programmeName: string;
    questions: { id: string; label: string }[];
    requiredDocuments: DocumentType[];
  };
  student: StudentView;
  documents: { id: string; type: DocumentType; fileName: string; url: string }[];
  eligibility: EligibilityResult;
  neighbours: { previousId: string | null; nextId: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<null | 'REJECT' | 'REQUEST_INFO'>(null);
  const [note, setNote] = useState('');

  async function decide(status: ApplicationStatus, message?: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/corporate/applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: message ?? '' }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        toast.push('error', payload.error ?? 'That action could not be completed.');
        return;
      }

      const labels: Partial<Record<ApplicationStatus, string>> = {
        SHORTLISTED: 'Applicant added to your shortlist.',
        APPROVED: 'Applicant moved to Selected.',
        UNSUCCESSFUL: 'Applicant marked as unsuccessful.',
        DOCUMENTS_REQUIRED: 'Information requested from the applicant.',
        UNDER_REVIEW: 'Application moved to review.',
      };
      toast.push('success', labels[status] ?? 'Application updated.');
      setDialog(null);
      setNote('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const uploadedTypes = new Set(documents.map((d) => d.type));

  return (
    <div>
      {/* --------------------------------------------------------- Top bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/corporate/applications"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Applications
        </Link>

        <div className="flex items-center gap-2">
          {neighbours.previousId ? (
            <Link
              href={`/corporate/applications/${neighbours.previousId}`}
              className="inline-flex h-9 items-center gap-1 rounded-btn border border-line bg-white px-3 text-[13px] font-medium text-ink-600 hover:bg-surface-subtle"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center gap-1 rounded-btn border border-line px-3 text-[13px] text-ink-300">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </span>
          )}
          {neighbours.nextId ? (
            <Link
              href={`/corporate/applications/${neighbours.nextId}`}
              className="inline-flex h-9 items-center gap-1 rounded-btn border border-line bg-white px-3 text-[13px] font-medium text-ink-600 hover:bg-surface-subtle"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center gap-1 rounded-btn border border-line px-3 text-[13px] text-ink-300">
              Next
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start [&>*]:min-w-0">
        <div className="space-y-5">
          {/* ------------------------------------------------- Identity card */}
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar firstName={student.firstName} lastName={student.lastName} size="xl" />
                <div className="min-w-0">
                  <h1 className="text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
                    {student.firstName} {student.lastName}
                  </h1>
                  <p className="mt-1 text-[13px] text-ink-500">
                    {student.programme ?? 'Programme not set'}
                    {student.qualificationLevel && (
                      <>
                        <span className="mx-1.5 text-ink-300">·</span>
                        {qualificationLabels[student.qualificationLevel]}
                      </>
                    )}
                  </p>
                  <p className="text-[13px] text-ink-400">{student.institution ?? 'Institution not set'}</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {application.matchScore !== null && (
                  <MatchBadge
                    score={application.matchScore}
                    classification={application.matchClassification ?? undefined}
                  />
                )}
                <EligibilityBadge outcome={eligibility.outcome} />
                <ApplicationStatusBadge status={application.status} />
              </div>
            </div>
          </Card>

          <Card>
            <Tabs
              className="px-6 pt-4"
              active={tab}
              onChange={setTab}
              tabs={[
                { key: 'overview', label: 'Overview' },
                { key: 'eligibility', label: 'Eligibility' },
                { key: 'documents', label: 'Documents', count: documents.length },
                { key: 'answers', label: 'Answers' },
              ]}
            />

            <div className="px-6 py-5">
              {tab === 'overview' && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <section>
                    <h2 className="text-[13px] font-semibold text-ink">Application details</h2>
                    <dl className="mt-3 space-y-2.5">
                      <Row label="Date applied" value={application.submittedAt ? formatDate(application.submittedAt) : '—'} />
                      <Row label="Programme applied for" value={application.programmeName} />
                      <Row label="Status" value={<ApplicationStatusBadge status={application.status} />} />
                    </dl>
                  </section>

                  <section>
                    <h2 className="text-[13px] font-semibold text-ink">Contact information</h2>
                    <dl className="mt-3 space-y-2.5">
                      <Row
                        label="Email"
                        value={
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-ink-300" />
                            {student.email}
                          </span>
                        }
                      />
                      <Row
                        label="Phone"
                        value={
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-ink-300" />
                            {student.mobile ?? '—'}
                          </span>
                        }
                      />
                      <Row
                        label="Location"
                        value={
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-ink-300" />
                            {student.city && student.province
                              ? `${student.city}, ${provinceLabels[student.province]}`
                              : '—'}
                          </span>
                        }
                      />
                    </dl>
                  </section>

                  <section className="sm:col-span-2 border-t border-line pt-5">
                    <h2 className="text-[13px] font-semibold text-ink">Academic summary</h2>
                    <dl className="mt-3 grid gap-2.5 sm:grid-cols-3">
                      <Row
                        label="Latest average"
                        value={student.academicAverage !== null ? `${student.academicAverage}%` : 'Not provided'}
                      />
                      <Row
                        label="Qualification"
                        value={
                          student.qualificationLevel ? qualificationLabels[student.qualificationLevel] : '—'
                        }
                      />
                      <Row
                        label="Year of study"
                        value={student.yearOfStudy ? `Year ${student.yearOfStudy}` : '—'}
                      />
                    </dl>
                    {student.achievements.length > 0 && (
                      <p className="mt-3 text-[13px] text-ink-500">
                        <span className="text-ink-400">Achievements: </span>
                        {student.achievements.map((a) => achievementLabels[a]).join(', ')}
                      </p>
                    )}
                  </section>

                  <section className="sm:col-span-2 border-t border-line pt-5">
                    <h2 className="text-[13px] font-semibold text-ink">Study preferences</h2>
                    {student.studyPreferences.length === 0 ? (
                      <p className="mt-2 text-[13px] text-ink-400">No study preferences recorded.</p>
                    ) : (
                      <ol className="mt-3 space-y-2">
                        {student.studyPreferences.map((preference) => (
                          <li
                            key={preference.preferenceNumber}
                            className="flex gap-3 rounded-field bg-surface-muted px-3.5 py-2.5 text-[13px]"
                          >
                            <span className="font-semibold text-ink-400">
                              {preference.preferenceNumber}
                            </span>
                            <span className="text-ink-700">
                              {preference.programme}
                              <span className="mx-1.5 text-ink-300">·</span>
                              {preference.institution}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  <section className="sm:col-span-2 border-t border-line pt-5">
                    <h2 className="text-[13px] font-semibold text-ink">Funding profile</h2>
                    <dl className="mt-3 space-y-2.5">
                      <Row
                        label="Household income"
                        value={student.householdIncome ? incomeBandLabels[student.householdIncome] : '—'}
                      />
                      <Row
                        label="Current funding"
                        value={
                          student.fundingSituation ? fundingSituationLabels[student.fundingSituation] : '—'
                        }
                      />
                      <Row
                        label="Needs funding for"
                        value={
                          student.fundingNeeds.length > 0
                            ? student.fundingNeeds.map((n) => fundingNeedLabels[n]).join(', ')
                            : '—'
                        }
                      />
                      <Row
                        label="Citizenship"
                        value={student.citizenship ? citizenshipLabels[student.citizenship] : '—'}
                      />
                      <Row
                        label="First-generation student"
                        value={student.firstGeneration ? triStateLabels[student.firstGeneration] : '—'}
                      />
                    </dl>
                  </section>
                </div>
              )}

              {tab === 'eligibility' && (
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[15px] font-semibold text-ink">Eligibility assessment</h2>
                    <EligibilityBadge outcome={eligibility.outcome} />
                  </div>
                  <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
                    Assessed against this programme’s current criteria. Missing information is flagged
                    for verification rather than counted as a failure.
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {eligibility.criteria.map((criterion, index) => (
                      <CriterionRow key={`${criterion.key}-${index}`} criterion={criterion} />
                    ))}
                  </ul>
                </section>
              )}

              {tab === 'documents' && (
                <section>
                  <h2 className="text-[15px] font-semibold text-ink">Documents</h2>

                  {application.requiredDocuments.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {application.requiredDocuments.map((type) => {
                        const provided = uploadedTypes.has(type);
                        return (
                          <li key={type} className="flex items-center gap-2.5 text-[13px]">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                provided ? 'bg-success-50 text-success-600' : 'bg-warning-50 text-warning-600'
                              }`}
                            >
                              {provided ? (
                                <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              )}
                            </span>
                            <span className={provided ? 'text-ink-700' : 'text-ink-600'}>
                              {documentTypeLabels[type]}
                              {!provided && <span className="ml-1.5 text-warning-600">outstanding</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {documents.length === 0 ? (
                    <p className="mt-4 rounded-field bg-surface-muted px-4 py-6 text-center text-[13px] text-ink-400">
                      The applicant has not attached any documents.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-line border-t border-line">
                      {documents.map((document) => (
                        <li key={document.id} className="flex items-center gap-3 py-3">
                          <FileText className="h-4 w-4 shrink-0 text-ink-300" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium text-ink">
                              {documentTypeLabels[document.type]}
                            </span>
                            <span className="block truncate text-xs text-ink-400">{document.fileName}</span>
                          </span>
                          <a
                            href={document.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-btn border border-line px-3 py-1.5 text-[13px] font-medium text-ink-600 hover:bg-surface-subtle"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {tab === 'answers' && (
                <section>
                  <h2 className="text-[15px] font-semibold text-ink">Programme questions</h2>
                  {application.questions.length === 0 ? (
                    <p className="mt-3 text-[13px] text-ink-400">
                      This programme did not ask any additional questions.
                    </p>
                  ) : (
                    <dl className="mt-4 space-y-4">
                      {application.questions.map((question) => {
                        const value = application.answers[question.id];
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
                  )}
                </section>
              )}
            </div>
          </Card>
        </div>

        {/* --------------------------------------------------------- Sidebar */}
        <div className="space-y-5 lg:sticky lg:top-6">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Review decision</h2>
            <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
              The applicant is emailed when you shortlist, select, reject or request information.
            </p>

            <div className="mt-4 space-y-2.5">
              <Button
                fullWidth
                onClick={() => decide('SHORTLISTED')}
                loading={busy}
                disabled={application.status === 'SHORTLISTED'}
              >
                {application.status === 'SHORTLISTED' ? 'Already shortlisted' : 'Add to Shortlist'}
              </Button>
              <Button
                fullWidth
                variant="success"
                onClick={() => decide('APPROVED')}
                loading={busy}
                disabled={application.status === 'APPROVED'}
              >
                Move to Selected
              </Button>
              <Button fullWidth variant="outline" onClick={() => setDialog('REQUEST_INFO')} disabled={busy}>
                Request Information
              </Button>
              <Button fullWidth variant="danger" onClick={() => setDialog('REJECT')} disabled={busy}>
                Reject
              </Button>
              {application.status !== 'UNDER_REVIEW' && (
                <Button fullWidth variant="ghost" onClick={() => decide('UNDER_REVIEW')} loading={busy}>
                  Move back to review
                </Button>
              )}
            </div>

            {application.reviewNotes && (
              <div className="mt-4 rounded-field bg-surface-muted px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
                  Last note
                </p>
                <p className="mt-1 text-[13px] leading-5 text-ink-600">{application.reviewNotes}</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Eligibility summary" />
            <div className="px-6 pb-6">
              <ul className="space-y-2.5">
                {eligibility.criteria.slice(0, 6).map((criterion, index) => (
                  <CriterionRow key={`${criterion.key}-${index}`} criterion={criterion} />
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>

      {/* ---------------------------------------------------------- Dialogs */}
      <Modal
        open={dialog === 'REJECT'}
        onClose={() => setDialog(null)}
        title="Reject this applicant?"
        description="They will be told their application was unsuccessful. Add a short reason if you'd like to."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => decide('UNSUCCESSFUL', note)} loading={busy}>
              Reject applicant
            </Button>
          </>
        }
      >
        <Field label="Reason" optional>
          <Textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Applications for this intake are now full."
          />
        </Field>
      </Modal>

      <Modal
        open={dialog === 'REQUEST_INFO'}
        onClose={() => setDialog(null)}
        title="Request more information"
        description="The applicant's status becomes “Documents Required” and they are emailed your message."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => decide('DOCUMENTS_REQUIRED', note)} loading={busy} disabled={!note.trim()}>
              Send request
            </Button>
          </>
        }
      >
        <Field label="What do you need from this applicant?" required>
          <Textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Please upload your most recent academic transcript."
          />
        </Field>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">{label}</dt>
      <dd className="text-[13px] text-ink-700">{value}</dd>
    </div>
  );
}
