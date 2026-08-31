'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ApplicationVolume, OffersFunding, ProgrammeTypeOffered } from '@prisma/client';
import { StepShell } from '@/components/onboarding/step-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/checkbox-group';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SelectTile } from '@/components/ui/toggle-chip';
import {
  Award,
  Briefcase,
  GraduationCap,
  MoreVertical,
  Sparkles,
  Target,
  Wallet,
} from '@/components/icons';
import { useFormSubmit } from '@/hooks/use-form-submit';
import {
  applicationVolumeLabels,
  offersFundingLabels,
  programmeTypeOfferedLabels,
  toOptions,
} from '@/lib/labels';
import { corporateSteps } from '@/lib/onboarding-steps';

const stepLabels = corporateSteps.map((s) => s.label);

const tileIcons: Record<ProgrammeTypeOffered, React.ReactNode> = {
  BURSARIES: <Award className="h-6 w-6" />,
  SCHOLARSHIPS: <GraduationCap className="h-6 w-6" />,
  GRANTS: <Wallet className="h-6 w-6" />,
  INTERNSHIPS: <Briefcase className="h-6 w-6" />,
  LEARNERSHIPS: <Target className="h-6 w-6" />,
  GRADUATE_PROGRAMMES: <Sparkles className="h-6 w-6" />,
  OTHER: <MoreVertical className="h-6 w-6" />,
};

/** Corporate step 3 — Funding Programmes. */
export function FundingProfileForm({
  initial,
}: {
  initial: {
    offersFunding: OffersFunding | null;
    programmeTypes: ProgrammeTypeOffered[];
    applicationVolume: ApplicationVolume | null;
  };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit } = useFormSubmit<{ redirectTo: string }>();

  const [offersFunding, setOffersFunding] = useState<OffersFunding | null>(initial.offersFunding);
  const [types, setTypes] = useState<ProgrammeTypeOffered[]>(initial.programmeTypes);
  const [volume, setVolume] = useState<string>(initial.applicationVolume ?? '');

  function toggleType(value: ProgrammeTypeOffered) {
    setTypes((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/corporate/onboarding',
      {
        step: 'funding',
        data: {
          offersFunding: offersFunding ?? undefined,
          programmeTypes: types,
          applicationVolume: volume || undefined,
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
        totalSteps={corporateSteps.length}
        stepLabels={stepLabels}
        backHref="/onboarding/organisation/role"
        title="Tell us about your funding programmes"
        description="What kind of programmes does your organisation offer?"
        wide
        footer={
          <Button type="submit" fullWidth size="lg" loading={submitting}>
            Continue
          </Button>
        }
      >
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        <div className="space-y-6">
          <fieldset>
            <legend className="mb-3 text-[13px] font-medium text-ink-700">
              Does your organisation currently offer education funding?
            </legend>
            <RadioGroup
              name="offersFunding"
              legend="Does your organisation currently offer education funding?"
              options={toOptions(offersFundingLabels)}
              value={offersFunding}
              onChange={setOffersFunding}
              columns={2}
            />
          </fieldset>

          <div>
            <p className="text-[13px] font-medium text-ink-700">
              What programmes do you manage?
              <span className="ml-1.5 font-normal text-ink-400">(Select all that apply)</span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(Object.keys(programmeTypeOfferedLabels) as ProgrammeTypeOffered[]).map((type) => (
                <SelectTile
                  key={type}
                  label={programmeTypeOfferedLabels[type]}
                  icon={tileIcons[type]}
                  selected={types.includes(type)}
                  onToggle={() => toggleType(type)}
                />
              ))}
            </div>
            {fieldErrors.programmeTypes && (
              <p role="alert" className="mt-2 text-[13px] font-medium text-danger-600">
                {fieldErrors.programmeTypes}
              </p>
            )}
          </div>

          <Field
            label="Approximately how many applications do you receive across all programmes annually?"
            error={fieldErrors.applicationVolume}
            required
          >
            <Select
              options={toOptions(applicationVolumeLabels)}
              placeholder="Select a range"
              value={volume}
              onChange={(event) => setVolume(event.target.value)}
              required
            />
          </Field>
        </div>
      </StepShell>
    </form>
  );
}
