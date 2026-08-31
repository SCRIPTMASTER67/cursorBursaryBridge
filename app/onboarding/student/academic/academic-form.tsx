'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Achievement, ResultType } from '@prisma/client';
import { SaveAndExit, StepShell } from '@/components/onboarding/step-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckboxGroup } from '@/components/ui/checkbox-group';
import { Field } from '@/components/ui/field';
import { PercentInput } from '@/components/ui/input';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { achievementLabels, resultTypeLabels, toOptions } from '@/lib/labels';
import { studentSteps } from '@/lib/onboarding-steps';

const stepLabels = studentSteps.map((s) => s.label);

/** Step 3 — Academic Profile. */
export function AcademicForm({
  initial,
}: {
  initial: {
    academicAverage: number | null;
    academicAverageUnknown: boolean;
    resultTypes: ResultType[];
    achievements: Achievement[];
  };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit, clearFieldError } = useFormSubmit<{ redirectTo: string }>();

  const [average, setAverage] = useState(initial.academicAverage ? String(initial.academicAverage) : '');
  const [unknown, setUnknown] = useState(initial.academicAverageUnknown);
  const [resultTypes, setResultTypes] = useState<ResultType[]>(initial.resultTypes);
  const [achievements, setAchievements] = useState<Achievement[]>(initial.achievements);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/student/onboarding',
      {
        step: 'academic',
        data: {
          academicAverage: unknown || average === '' ? null : Number(average),
          academicAverageUnknown: unknown,
          resultTypes,
          achievements,
        },
      },
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
        step={3}
        totalSteps={studentSteps.length}
        stepLabels={stepLabels}
        backHref="/onboarding/student/preferences"
        title="Let’s talk about your academic profile"
        description="This helps us match you with opportunities you may qualify for. You can update it later as your results come in."
        footer={
          <>
            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Continue
            </Button>
            <SaveAndExit />
          </>
        }
      >
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        <div className="space-y-6">
          <Field label="What is your latest academic average?" error={fieldErrors.academicAverage}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <PercentInput
                value={unknown ? '' : average}
                disabled={unknown}
                placeholder="82"
                onChange={(event) => {
                  setAverage(event.target.value);
                  clearFieldError('academicAverage');
                }}
                className="sm:max-w-[140px]"
                aria-label="Latest academic average percentage"
              />
              <Checkbox
                checked={unknown}
                onChange={(event) => {
                  setUnknown(event.target.checked);
                  clearFieldError('academicAverage');
                }}
                label="I don’t know"
              />
            </div>
          </Field>

          <fieldset>
            <legend className="mb-3 text-[13px] font-medium text-ink-700">
              What type of results do you have?
            </legend>
            <CheckboxGroup
              options={toOptions(resultTypeLabels)}
              values={resultTypes}
              onChange={setResultTypes}
              exclusive={['NONE_YET']}
            />
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-[13px] font-medium text-ink-700">
              Do you have any academic achievements?
            </legend>
            <p className="mb-3 text-[13px] text-ink-400">Optional — this can strengthen your applications.</p>
            <CheckboxGroup
              options={toOptions(achievementLabels)}
              values={achievements}
              onChange={setAchievements}
              exclusive={['NONE']}
            />
          </fieldset>
        </div>
      </StepShell>
    </form>
  );
}
