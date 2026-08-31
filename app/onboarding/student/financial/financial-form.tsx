'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BursaryStatus, Citizenship, IncomeBand, TriState } from '@prisma/client';
import { SaveAndExit, StepShell } from '@/components/onboarding/step-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/checkbox-group';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { bursaryStatusLabels, citizenshipLabels, incomeBandLabels, toOptions, triStateLabels } from '@/lib/labels';
import { studentSteps } from '@/lib/onboarding-steps';

const stepLabels = studentSteps.map((s) => s.label);

/**
 * Step 5 — Financial Profile and personal eligibility.
 *
 * Deliberately asks for a band rather than an exact figure, and never for
 * documents: proof of income belongs to an application, not to registration.
 */
export function FinancialForm({
  initial,
}: {
  initial: {
    householdIncome: IncomeBand | null;
    bursaryStatus: BursaryStatus | null;
    dateOfBirth: string;
    citizenship: Citizenship | null;
    firstGeneration: TriState | null;
    disability: TriState | null;
    orphanVulnerable: TriState | null;
  };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit } = useFormSubmit<{ redirectTo: string }>();

  const [values, setValues] = useState({
    householdIncome: initial.householdIncome ?? '',
    bursaryStatus: initial.bursaryStatus ?? '',
    dateOfBirth: initial.dateOfBirth,
    citizenship: initial.citizenship ?? '',
    firstGeneration: initial.firstGeneration,
    disability: initial.disability,
    orphanVulnerable: initial.orphanVulnerable,
  });

  function update<K extends keyof typeof values>(field: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/student/onboarding',
      {
        step: 'financial',
        data: {
          householdIncome: values.householdIncome || undefined,
          bursaryStatus: values.bursaryStatus || undefined,
          dateOfBirth: values.dateOfBirth || null,
          citizenship: values.citizenship || null,
          firstGeneration: values.firstGeneration,
          disability: values.disability,
          orphanVulnerable: values.orphanVulnerable,
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
        step={5}
        totalSteps={studentSteps.length}
        stepLabels={stepLabels}
        backHref="/onboarding/student/funding"
        title="Tell us about your financial situation"
        description="Many funders set a household income threshold. This information helps us identify opportunities that may be relevant to you — we never ask for exact figures or financial documents here."
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
          <Field label="Approximate annual household income" error={fieldErrors.householdIncome} required>
            <Select
              options={toOptions(incomeBandLabels)}
              placeholder="Select an income range"
              value={values.householdIncome}
              onChange={(event) => update('householdIncome', event.target.value as IncomeBand)}
              required
            />
          </Field>

          <fieldset>
            <legend className="mb-3 text-[13px] font-medium text-ink-700">
              Are you currently receiving a bursary or scholarship?
            </legend>
            <RadioGroup
              name="bursaryStatus"
              legend="Are you currently receiving a bursary or scholarship?"
              options={toOptions(bursaryStatusLabels)}
              value={(values.bursaryStatus || null) as BursaryStatus | null}
              onChange={(value) => update('bursaryStatus', value)}
            />
            {fieldErrors.bursaryStatus && (
              <p role="alert" className="mt-2 text-[13px] font-medium text-danger-600">
                {fieldErrors.bursaryStatus}
              </p>
            )}
          </fieldset>

          <div className="space-y-5 border-t border-line pt-5">
            <p className="text-[13px] font-semibold text-ink">
              Personal eligibility
              <span className="ml-1.5 font-normal text-ink-300">Optional</span>
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth" error={fieldErrors.dateOfBirth} optional>
                <Input
                  type="date"
                  value={values.dateOfBirth}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => update('dateOfBirth', event.target.value)}
                />
              </Field>

              <Field label="Citizenship / residency" optional>
                <Select
                  options={toOptions(citizenshipLabels)}
                  placeholder="Select an option"
                  value={values.citizenship}
                  onChange={(event) => update('citizenship', event.target.value as Citizenship)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  { key: 'firstGeneration', label: 'First-generation student' },
                  { key: 'disability', label: 'Living with a disability' },
                  { key: 'orphanVulnerable', label: 'Orphaned or vulnerable' },
                ] as const
              ).map((item) => (
                <Field key={item.key} label={item.label} optional>
                  <Select
                    options={toOptions(triStateLabels)}
                    placeholder="Select"
                    value={values[item.key] ?? ''}
                    onChange={(event) => update(item.key, (event.target.value || null) as TriState | null)}
                  />
                </Field>
              ))}
            </div>
          </div>
        </div>
      </StepShell>
    </form>
  );
}
