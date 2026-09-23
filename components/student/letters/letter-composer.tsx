'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { ArrowLeft, ArrowRight, Check, Spinner } from '@/components/icons';
import { QUESTIONS } from '@/lib/letters/questions';
import type { LetterAnswers, LetterGap } from '@/lib/letters/types';
import { cn } from '@/lib/utils';

/**
 * Writing a new letter.
 *
 * Three steps: which bursary, what the student wants to say, and what their
 * profile will contribute. The third step is not a formality — it shows the
 * student exactly which facts will appear, because those sentences go out
 * under their name and they should see them before anyone else does.
 */

export type LetterTarget = {
  id: string;
  name: string;
  organisationName: string;
  applied: boolean;
};

const STEPS = ['Bursary', 'Your answers', 'Review'];

export function LetterComposer({
  targets,
  previousAnswers,
  profileGaps,
  factsPreview,
  presetTargetId,
}: {
  targets: LetterTarget[];
  previousAnswers: LetterAnswers;
  profileGaps: LetterGap[];
  factsPreview: { label: string; value: string }[];
  presetTargetId?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(presetTargetId ? 1 : 0);
  const [targetId, setTargetId] = useState(presetTargetId ?? targets[0]?.id ?? 'OTHER');
  const [manualName, setManualName] = useState('');
  const [manualOrg, setManualOrg] = useState('');
  const [answers, setAnswers] = useState<LetterAnswers>(previousAnswers);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manual = targetId === 'OTHER';
  const chosen = useMemo(() => targets.find((t) => t.id === targetId), [targets, targetId]);

  const options = [
    ...targets.map((target) => ({
      value: target.id,
      label: `${target.name} — ${target.organisationName}${target.applied ? ' (applied)' : ''}`,
    })),
    { value: 'OTHER', label: 'Another bursary — I will type the name' },
  ];

  const answered = QUESTIONS.filter((question) => (answers[question.key] ?? '').trim()).length;

  function canLeaveStepOne() {
    if (!manual) return Boolean(targetId);
    return manualName.trim().length >= 2 && manualOrg.trim().length >= 2;
  }

  async function generate() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/student/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundingProgrammeId: manual ? null : targetId,
          opportunityName: manual ? manualName : undefined,
          organisationName: manual ? manualOrg : undefined,
          answers,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? 'The letter could not be written. Try again.');
        return;
      }
      toast.push('success', 'Your draft is ready to edit.');
      router.push(`/student/letters/${data.letter.id}`);
      router.refresh();
    } catch {
      setError('The letter could not be written. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      {/* ----------------------------------------------------------- Stepper */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                index < step && 'bg-brand-600 text-white',
                index === step && 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
                index > step && 'bg-line text-ink-400',
              )}
            >
              {index < step ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : index + 1}
            </span>
            <span className={index === step ? 'font-semibold text-ink' : 'text-ink-400'}>
              {label}
            </span>
            {index < STEPS.length - 1 && <span className="mx-1 h-px w-5 bg-line" />}
          </li>
        ))}
      </ol>

      {error && (
        <Alert tone="danger" title="That did not work">
          {error}
        </Alert>
      )}

      {/* ------------------------------------------------- Step 1: which one */}
      {step === 0 && (
        <Card>
          <CardHeader
            title="Which bursary is this letter for?"
            description="Choosing one you are applying to lets the letter answer that funder's own requirements."
          />
          <CardBody className="space-y-4">
            <Field label="Bursary">
              <Select
                options={options}
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              />
            </Field>

            {manual && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bursary name" required>
                  <Input
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder="e.g. Engineering Bursary 2026"
                  />
                </Field>
                <Field label="Organisation offering it" required>
                  <Input
                    value={manualOrg}
                    onChange={(event) => setManualOrg(event.target.value)}
                    placeholder="e.g. Eskom"
                  />
                </Field>
              </div>
            )}

            {manual ? (
              <Alert tone="info" title="We have not read this bursary's requirements">
                Your letter will be built from your profile and your own answers. If you pick a
                bursary from the list instead, the letter can also point at the specific
                requirements that funder states.
              </Alert>
            ) : (
              chosen && (
                <p className="text-[13px] text-ink-500">
                  Writing to{' '}
                  <span className="font-semibold text-ink">{chosen.organisationName}</span> about{' '}
                  {chosen.name}.
                </p>
              )
            )}
          </CardBody>
        </Card>
      )}

      {/* ---------------------------------------------- Step 2: their words */}
      {step === 1 && (
        <Card>
          <CardHeader
            title="What do you want this funder to know?"
            description="Answer in your own words. Every sentence you write here goes into the letter as you wrote it — nothing is invented for you, so anything you leave blank is simply left out."
          />
          <CardBody className="space-y-5">
            {QUESTIONS.map((question) => (
              <Field key={question.key} label={question.label} description={question.hint} optional>
                <Textarea
                  rows={question.rows}
                  value={answers[question.key] ?? ''}
                  maxLength={2000}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [question.key]: event.target.value }))
                  }
                />
              </Field>
            ))}
            <p className="text-[13px] text-ink-400">
              {answered} of {QUESTIONS.length} answered. You can generate with any number of them.
            </p>
          </CardBody>
        </Card>
      )}

      {/* -------------------------------------------- Step 3: what we'll use */}
      {step === 2 && (
        <Card>
          <CardHeader
            title="What the letter will say about you"
            description="Taken from your profile. Check it before it goes out under your name."
          />
          <CardBody className="space-y-4">
            {factsPreview.length === 0 ? (
              <Alert tone="warning" title="Your profile has nothing to add yet">
                The letter will be built from your answers alone. Adding your course, institution
                and results makes it considerably stronger.
              </Alert>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {factsPreview.map((fact) => (
                  <div key={fact.label} className="rounded-lg border border-line px-3.5 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
                      {fact.label}
                    </dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {profileGaps.length > 0 && (
              <Alert tone="warning" title="Worth adding first">
                <ul className="mt-1 space-y-1.5">
                  {profileGaps.map((gap) => (
                    <li key={`${gap.key}-${gap.question}`}>
                      <span className="font-medium">{gap.question}</span> — {gap.because}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}

            <p className="text-[13px] leading-6 text-ink-500">
              The draft is assembled from these facts and your own sentences. You can edit every
              word of it afterwards, and nothing is sent anywhere until you send it yourself.
            </p>
          </CardBody>
        </Card>
      )}

      {/* ---------------------------------------------------------- Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || submitting}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((current) => current + 1)}
            disabled={step === 0 && !canLeaveStepOne()}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={generate} disabled={submitting}>
            {submitting ? <Spinner className="h-4 w-4" /> : null}
            {submitting ? 'Writing your draft…' : 'Write my draft'}
          </Button>
        )}
      </div>
    </div>
  );
}
