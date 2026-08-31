'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProcessChallenge, ProcessMethod } from '@prisma/client';
import { StepShell } from '@/components/onboarding/step-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckboxGroup } from '@/components/ui/checkbox-group';
import { ToggleChip } from '@/components/ui/toggle-chip';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { processChallengeLabels, processMethodLabels, toOptions } from '@/lib/labels';
import { corporateSteps } from '@/lib/onboarding-steps';
import { MAX_CHALLENGES } from '@/lib/validation/corporate';

const stepLabels = corporateSteps.map((s) => s.label);

/** Corporate step 4 — Current Process (optional). */
export function CurrentProcessForm({
  initial,
}: {
  initial: { processMethods: ProcessMethod[]; challenges: ProcessChallenge[] };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit } = useFormSubmit<{ redirectTo: string }>();

  const [methods, setMethods] = useState<ProcessMethod[]>(initial.processMethods);
  const [challenges, setChallenges] = useState<ProcessChallenge[]>(initial.challenges);

  function toggleChallenge(value: ProcessChallenge) {
    setChallenges((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : current.length >= MAX_CHALLENGES
          ? current
          : [...current, value],
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/corporate/onboarding',
      { step: 'process', data: { processMethods: methods, challenges } },
      {
        onSuccess: (data) => {
          router.push(data.redirectTo);
          router.refresh();
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepShell
        step={4}
        totalSteps={corporateSteps.length}
        stepLabels={stepLabels}
        backHref="/onboarding/organisation/funding"
        title="Help us understand your current process"
        description="Optional, but it helps us tailor Bursary-Bridge to how your team already works."
        footer={
          <Button type="submit" fullWidth size="lg" loading={submitting}>
            Continue
          </Button>
        }
      >
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        <div className="space-y-6">
          <fieldset>
            <legend className="mb-1 text-[13px] font-medium text-ink-700">
              How do you currently manage applications?
            </legend>
            <p className="mb-3 text-[13px] text-ink-400">Select all that apply.</p>
            <CheckboxGroup
              options={toOptions(processMethodLabels)}
              values={methods}
              onChange={setMethods}
              columns={2}
            />
          </fieldset>

          <div className="border-t border-line pt-5">
            <p className="text-[13px] font-medium text-ink-700">What are your biggest challenges?</p>
            <p className="mb-3 mt-1 text-[13px] text-ink-400">
              Select up to {MAX_CHALLENGES}. {challenges.length} selected.
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(processChallengeLabels) as ProcessChallenge[]).map((challenge) => (
                <ToggleChip
                  key={challenge}
                  label={processChallengeLabels[challenge]}
                  selected={challenges.includes(challenge)}
                  disabled={challenges.length >= MAX_CHALLENGES}
                  onToggle={() => toggleChallenge(challenge)}
                />
              ))}
            </div>
            {fieldErrors.challenges && (
              <p role="alert" className="mt-2 text-[13px] font-medium text-danger-600">
                {fieldErrors.challenges}
              </p>
            )}
          </div>
        </div>
      </StepShell>
    </form>
  );
}
