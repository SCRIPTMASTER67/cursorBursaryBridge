'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FundingNeed, FundingSituation } from '@prisma/client';
import { SaveAndExit, StepShell } from '@/components/onboarding/step-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckboxGroup } from '@/components/ui/checkbox-group';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { fundingNeedLabels, fundingSituationLabels, toOptions } from '@/lib/labels';
import { studentSteps } from '@/lib/onboarding-steps';

const stepLabels = studentSteps.map((s) => s.label);

/**
 * Step 4 — Funding Needs.
 *
 * The expense list and the coverage options are split visually because
 * "Full funding" is a different kind of answer to "Accommodation".
 */
const expenseNeeds: FundingNeed[] = [
  'TUITION_FEES',
  'REGISTRATION_FEES',
  'ACCOMMODATION',
  'BOOKS_MATERIALS',
  'MEALS_LIVING',
  'TRANSPORT',
  'LAPTOP_DEVICE',
  'OTHER_EXPENSES',
];

const coverageNeeds: FundingNeed[] = ['FULL_FUNDING', 'PARTIAL_FUNDING', 'NOT_SURE'];

export function FundingForm({
  initial,
}: {
  initial: { fundingNeeds: FundingNeed[]; fundingSituation: FundingSituation | null };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit } = useFormSubmit<{ redirectTo: string }>();

  const [needs, setNeeds] = useState<FundingNeed[]>(initial.fundingNeeds);
  const [situation, setSituation] = useState<string>(initial.fundingSituation ?? '');

  const expenseOptions = expenseNeeds.map((value) => ({ value, label: fundingNeedLabels[value] }));
  const coverageOptions = coverageNeeds.map((value) => ({ value, label: fundingNeedLabels[value] }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/student/onboarding',
      { step: 'funding', data: { fundingNeeds: needs, fundingSituation: situation || undefined } },
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
        totalSteps={studentSteps.length}
        stepLabels={stepLabels}
        backHref="/onboarding/student/academic"
        title="What do you need funding for?"
        description="Select all that apply. Funders describe what their programmes cover, and we match that against what you need."
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
        {fieldErrors.fundingNeeds && (
          <Alert tone="danger" className="mb-5">{fieldErrors.fundingNeeds}</Alert>
        )}

        <div className="space-y-6">
          <CheckboxGroup options={expenseOptions} values={needs} onChange={setNeeds} />

          <div className="border-t border-line pt-5">
            <CheckboxGroup options={coverageOptions} values={needs} onChange={setNeeds} exclusive={['NOT_SURE']} />
          </div>

          <Field
            label="What is your current funding situation?"
            error={fieldErrors.fundingSituation}
            required
            className="border-t border-line pt-5"
          >
            <Select
              options={toOptions(fundingSituationLabels)}
              placeholder="Select your current situation"
              value={situation}
              onChange={(event) => setSituation(event.target.value)}
              required
            />
          </Field>
        </div>
      </StepShell>
    </form>
  );
}
