'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DocumentType, QuestionType } from '@prisma/client';
import { MatchExplanation } from '@/components/student/match-explanation';
import { SummarySections } from '@/components/student/summary-sections';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StepDots } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ArrowLeft, Check, FileText, Upload } from '@/components/icons';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { documentTypeLabels } from '@/lib/labels';
import type { MatchResult } from '@/lib/matching';
import { deadlineLabel } from '@/lib/utils';
import type { SummarySection } from '@/services/student-summary';

type Question = {
  id: string;
  label: string;
  helpText: string | null;
  type: QuestionType;
  required: boolean;
  options: string[];
};

type AnswerValue = string | string[];

const steps = ['Your information', 'Programme questions', 'Documents', 'Review & submit'];

/**
 * Four-step application flow.
 *
 * Step 1 is read-only: it shows the profile that will be sent, with links back
 * to edit it, rather than asking for it again.
 */
export function ApplicationWizard({
  programme,
  match,
  summary,
  questions,
  documents,
  savedAnswers,
}: {
  programme: {
    id: string;
    name: string;
    organisationName: string;
    closingDate: string;
    requiredDocuments: DocumentType[];
  };
  match: MatchResult;
  summary: SummarySection[];
  questions: Question[];
  documents: { id: string; type: DocumentType; fileName: string }[];
  savedAnswers: Record<string, AnswerValue>;
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit } = useFormSubmit<{ redirectTo: string }>();

  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(savedAnswers);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setDraftSaved(false);
  }

  const unansweredRequired = questions.filter((question) => {
    if (!question.required) return false;
    const value = answers[question.id];
    return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  });

  async function saveDraft() {
    const result = await submit('/api/student/applications', {
      intent: 'draft',
      fundingProgrammeId: programme.id,
      answers,
      documentIds: selectedDocuments,
    });
    if (result) setDraftSaved(true);
  }

  async function submitApplication() {
    await submit(
      '/api/student/applications',
      {
        intent: 'submit',
        fundingProgrammeId: programme.id,
        answers,
        documentIds: selectedDocuments,
        confirmAccurate: confirmed,
      },
      {
        onSuccess: (data) => {
          router.push(data.redirectTo);
          router.refresh();
        },
      },
    );
  }

  // The missing documents this programme asked for, by type.
  const availableTypes = new Set(documents.map((d) => d.type));
  const missingDocumentTypes = programme.requiredDocuments.filter((type) => !availableTypes.has(type));

  return (
    <div className="mx-auto max-w-[860px]">
      <Link
        href={`/student/opportunities/${programme.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to opportunity
      </Link>

      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Apply to {programme.name}</h1>
        <p className="mt-1.5 text-[13px] text-ink-400">
          {programme.organisationName}
          <span className="mx-1.5">·</span>
          {deadlineLabel(programme.closingDate)}
        </p>
      </div>

      <Card className="mb-5 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-ink">
            Step {step} of {steps.length}
            <span className="ml-2 font-normal text-ink-400">{steps[step - 1]}</span>
          </p>
          <StepDots total={steps.length} current={step} labels={steps} />
        </div>
      </Card>

      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      {draftSaved && (
        <Alert tone="success" className="mb-5">
          Your draft has been saved. You can finish it any time before the closing date.
        </Alert>
      )}

      {/* ------------------------------------------------ Step 1: profile */}
      {step === 1 && (
        <div className="space-y-5">
          <Alert tone="info">
            This is the information Bursary-Bridge will send with your application. You created it
            once — there’s nothing to retype here.
          </Alert>
          <SummarySections sections={summary} />
        </div>
      )}

      {/* ---------------------------------------------- Step 2: questions */}
      {step === 2 && (
        <Card>
          <CardHeader
            title="Questions from this funder"
            description={
              questions.length === 0
                ? 'This programme has no additional questions.'
                : 'These questions are specific to this programme.'
            }
          />
          <div className="space-y-5 px-6 pb-6">
            {questions.length === 0 ? (
              <p className="rounded-field bg-surface-muted px-4 py-6 text-center text-[13px] text-ink-400">
                Nothing further is needed — continue to documents.
              </p>
            ) : (
              questions.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={answers[question.id]}
                  onChange={(value) => setAnswer(question.id, value)}
                  error={fieldErrors[`answers.${question.id}`]}
                />
              ))
            )}
          </div>
        </Card>
      )}

      {/* ---------------------------------------------- Step 3: documents */}
      {step === 3 && (
        <Card>
          <CardHeader
            title="Supporting documents"
            description="Attach the documents this programme requires. You can upload new ones from your Documents page."
          />
          <div className="space-y-5 px-6 pb-6">
            {programme.requiredDocuments.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-ink">Required by this programme</p>
                <ul className="mt-2.5 space-y-2">
                  {programme.requiredDocuments.map((type) => {
                    const have = availableTypes.has(type);
                    return (
                      <li key={type} className="flex items-center gap-2.5 text-[13px]">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full ${
                            have ? 'bg-success-50 text-success-600' : 'bg-warning-50 text-warning-600'
                          }`}
                        >
                          {have ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className={have ? 'text-ink-700' : 'text-ink-600'}>
                          {documentTypeLabels[type]}
                          {!have && <span className="ml-1.5 text-warning-600">not uploaded yet</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {documents.length === 0 ? (
              <div className="rounded-field border border-dashed border-line-strong px-4 py-8 text-center">
                <FileText className="mx-auto h-6 w-6 text-ink-300" />
                <p className="mt-3 text-[13px] font-medium text-ink">You haven’t uploaded any documents</p>
                <p className="mt-1 text-[13px] text-ink-400">
                  Documents are optional to save a draft, but this funder may ask for them.
                </p>
                <Link
                  href="/student/documents"
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                >
                  <Upload className="h-4 w-4" />
                  Upload documents
                </Link>
              </div>
            ) : (
              <div>
                <p className="mb-2.5 text-[13px] font-semibold text-ink">Attach from your documents</p>
                <div className="space-y-2.5">
                  {documents.map((document) => (
                    <Checkbox
                      key={document.id}
                      checked={selectedDocuments.includes(document.id)}
                      onChange={(event) =>
                        setSelectedDocuments((current) =>
                          event.target.checked
                            ? [...current, document.id]
                            : current.filter((id) => id !== document.id),
                        )
                      }
                      label={documentTypeLabels[document.type]}
                      description={document.fileName}
                    />
                  ))}
                </div>
              </div>
            )}

            {missingDocumentTypes.length > 0 && (
              <Alert tone="warning">
                You can still submit, but the funder may place your application on “Documents
                Required” until they receive: {missingDocumentTypes.map((t) => documentTypeLabels[t]).join(', ')}.
              </Alert>
            )}
          </div>
        </Card>
      )}

      {/* ------------------------------------------------- Step 4: review */}
      {step === 4 && (
        <div className="space-y-5">
          <MatchExplanation match={match} title="How you match this programme" />

          <Card>
            <CardHeader title="Review your application" description="Check everything before you submit." />
            <div className="space-y-4 px-6 pb-6">
              <ReviewBlock title="Programme">
                {programme.name} · {programme.organisationName}
              </ReviewBlock>

              {questions.length > 0 && (
                <ReviewBlock title="Your answers">
                  <dl className="space-y-3">
                    {questions.map((question) => {
                      const value = answers[question.id];
                      return (
                        <div key={question.id}>
                          <dt className="text-[13px] font-medium text-ink-700">{question.label}</dt>
                          <dd className="mt-0.5 whitespace-pre-line text-[13px] text-ink-500">
                            {value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
                              ? 'Not answered'
                              : Array.isArray(value)
                                ? value.join(', ')
                                : String(value)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </ReviewBlock>
              )}

              <ReviewBlock title="Documents attached">
                {selectedDocuments.length === 0
                  ? 'No documents attached'
                  : documents
                      .filter((d) => selectedDocuments.includes(d.id))
                      .map((d) => documentTypeLabels[d.type])
                      .join(', ')}
              </ReviewBlock>

              {unansweredRequired.length > 0 && (
                <Alert tone="warning">
                  {unansweredRequired.length} required{' '}
                  {unansweredRequired.length === 1 ? 'question is' : 'questions are'} still
                  unanswered. Go back to step 2 to complete{' '}
                  {unansweredRequired.length === 1 ? 'it' : 'them'}.
                </Alert>
              )}

              <div className="border-t border-line pt-4">
                <Checkbox
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  label="I confirm the information in this application is accurate and complete."
                />
                {fieldErrors.confirmAccurate && (
                  <p role="alert" className="mt-2 text-[13px] font-medium text-danger-600">
                    {fieldErrors.confirmAccurate}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* --------------------------------------------------------- Actions */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={saveDraft} loading={submitting && step !== 4}>
            Save Draft
          </Button>
        </div>

        {step < steps.length ? (
          <Button size="lg" onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={submitApplication}
            loading={submitting}
            disabled={!confirmed || unansweredRequired.length > 0}
          >
            Submit Application
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-field bg-surface-muted px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">{title}</p>
      <div className="mt-1.5 text-[13px] text-ink-700">{children}</div>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  error,
}: {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  error?: string;
}) {
  const stringValue = typeof value === 'string' ? value : '';

  const name = `answers.${question.id}`;

  return (
    <Field
      label={question.label}
      description={question.helpText ?? undefined}
      required={question.required}
      error={error}
    >
      {question.type === 'LONG_TEXT' && (
        <Textarea
          name={name}
          rows={5}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your answer"
        />
      )}
      {question.type === 'SHORT_TEXT' && (
        <Input name={name} value={stringValue} onChange={(event) => onChange(event.target.value)} />
      )}
      {question.type === 'NUMBER' && (
        <Input
          name={name}
          type="number"
          inputMode="numeric"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {question.type === 'DATE' && (
        <Input name={name} type="date" value={stringValue} onChange={(event) => onChange(event.target.value)} />
      )}
      {question.type === 'YES_NO' && (
        <Select
          name={name}
          options={[
            { value: 'Yes', label: 'Yes' },
            { value: 'No', label: 'No' },
          ]}
          placeholder="Select an answer"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {question.type === 'SINGLE_SELECT' && (
        <Select
          name={name}
          options={question.options.map((option) => ({ value: option, label: option }))}
          placeholder="Select an option"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {question.type === 'MULTI_SELECT' && (
        <div className="space-y-2.5">
          {question.options.map((option) => {
            const selected = Array.isArray(value) ? value : [];
            return (
              <Checkbox
                key={option}
                name={name}
                checked={selected.includes(option)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option]
                      : selected.filter((item) => item !== option),
                  )
                }
                label={option}
              />
            );
          })}
        </div>
      )}
    </Field>
  );
}
