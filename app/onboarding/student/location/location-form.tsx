'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { CareerInterest, Province, StudyLocationPreference } from '@prisma/client';
import { SaveAndExit, StepShell } from '@/components/onboarding/step-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/checkbox-group';
import { Combobox } from '@/components/ui/combobox';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ToggleChip } from '@/components/ui/toggle-chip';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { careerInterestLabels, provinceLabels, studyLocationLabels, toOptions } from '@/lib/labels';
import { studentSteps } from '@/lib/onboarding-steps';
import { MAX_CAREER_INTERESTS } from '@/lib/validation/student';
import { southAfricanCities } from '@/services/catalog';

const stepLabels = studentSteps.map((s) => s.label);
const careerOptions = (Object.keys(careerInterestLabels) as CareerInterest[]).map((value) => ({
  value,
  label: careerInterestLabels[value],
}));

/** Step 6 — Location and career interests. */
export function LocationForm({
  initial,
}: {
  initial: {
    province: Province | null;
    city: string | null;
    studyLocationPreference: StudyLocationPreference | null;
    careerInterests: CareerInterest[];
  };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit } = useFormSubmit<{ redirectTo: string }>();

  const [province, setProvince] = useState<string>(initial.province ?? '');
  const [city, setCity] = useState<string | null>(initial.city);
  const [locationPreference, setLocationPreference] = useState<StudyLocationPreference | null>(
    initial.studyLocationPreference,
  );
  const [interests, setInterests] = useState<CareerInterest[]>(initial.careerInterests);

  // The city list narrows to the selected province, so the search stays short.
  const cityItems = useMemo(() => {
    const cities = province ? (southAfricanCities[province] ?? []) : Object.values(southAfricanCities).flat();
    return cities.map((name) => ({ value: name, label: name }));
  }, [province]);

  function toggleInterest(value: CareerInterest) {
    setInterests((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : current.length >= MAX_CAREER_INTERESTS
          ? current
          : [...current, value],
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/student/onboarding',
      {
        step: 'location',
        data: {
          province: province || undefined,
          city: city ?? '',
          studyLocationPreference: locationPreference ?? undefined,
          careerInterests: interests,
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
        step={6}
        totalSteps={studentSteps.length}
        stepLabels={stepLabels}
        backHref="/onboarding/student/financial"
        title="Where are you and what interests you?"
        description="Some funders support students from specific provinces. We only need your province and town — never your street address."
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
          <Field label="Province" error={fieldErrors.province} required>
            <Select
              options={toOptions(provinceLabels)}
              placeholder="Select your province"
              value={province}
              onChange={(event) => {
                setProvince(event.target.value);
                setCity(null);
              }}
              required
            />
          </Field>

          <Field label="City / Town" error={fieldErrors.city} required>
            <Combobox
              items={cityItems}
              value={city}
              onChange={setCity}
              placeholder={province ? 'Search your city or town' : 'Select a province first'}
              ariaLabel="City or town"
              disabled={!province}
              invalid={Boolean(fieldErrors.city)}
            />
          </Field>

          <fieldset>
            <legend className="mb-3 text-[13px] font-medium text-ink-700">
              Where do you expect to study?
            </legend>
            <RadioGroup
              name="studyLocationPreference"
              legend="Where do you expect to study?"
              options={toOptions(studyLocationLabels)}
              value={locationPreference}
              onChange={setLocationPreference}
            />
            {fieldErrors.studyLocationPreference && (
              <p role="alert" className="mt-2 text-[13px] font-medium text-danger-600">
                {fieldErrors.studyLocationPreference}
              </p>
            )}
          </fieldset>

          <div className="border-t border-line pt-5">
            <p className="text-[13px] font-medium text-ink-700">What careers or industries interest you?</p>
            <p className="mb-3 mt-1 text-[13px] text-ink-400">
              Select up to {MAX_CAREER_INTERESTS}. {interests.length} selected.
            </p>
            <div className="flex flex-wrap gap-2">
              {careerOptions.map((option) => (
                <ToggleChip
                  key={option.value}
                  label={option.label}
                  selected={interests.includes(option.value)}
                  disabled={interests.length >= MAX_CAREER_INTERESTS}
                  onToggle={() => toggleInterest(option.value)}
                />
              ))}
            </div>
            {fieldErrors.careerInterests && (
              <p role="alert" className="mt-2 text-[13px] font-medium text-danger-600">
                {fieldErrors.careerInterests}
              </p>
            )}
          </div>
        </div>
      </StepShell>
    </form>
  );
}
