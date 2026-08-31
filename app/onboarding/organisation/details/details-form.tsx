'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Industry, OrganisationType } from '@prisma/client';
import { StepShell } from '@/components/onboarding/step-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { industryLabels, organisationTypeLabels, toOptions } from '@/lib/labels';
import { corporateSteps } from '@/lib/onboarding-steps';

const stepLabels = corporateSteps.map((s) => s.label);

/** Corporate step 1 — Organisation Details. */
export function OrganisationDetailsForm({
  initial,
}: {
  initial: { name: string; type: OrganisationType; industry: Industry; website: string; country: string };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit, clearFieldError } = useFormSubmit<{ redirectTo: string }>();
  const [values, setValues] = useState(initial);

  function update<K extends keyof typeof values>(field: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    clearFieldError(field as string);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/corporate/onboarding',
      { step: 'details', data: values },
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
        step={1}
        totalSteps={corporateSteps.length}
        stepLabels={stepLabels}
        backHref={null}
        title="Tell us about your organisation"
        description="This helps us set up your organisation profile and show students who is behind each funding programme."
        footer={
          <Button type="submit" fullWidth size="lg" loading={submitting}>
            Continue
          </Button>
        }
      >
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        <div className="space-y-5">
          <Field label="Organisation name" error={fieldErrors.name} required>
            <Input
              value={values.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="e.g. Kgotso Holdings (Pty) Ltd"
              required
            />
          </Field>

          <Field label="Organisation type" error={fieldErrors.type} required>
            <Select
              options={toOptions(organisationTypeLabels)}
              placeholder="Select organisation type"
              value={values.type}
              onChange={(event) => update('type', event.target.value as OrganisationType)}
              required
            />
          </Field>

          <Field label="Industry" error={fieldErrors.industry} required>
            <Select
              options={toOptions(industryLabels)}
              placeholder="Select your industry"
              value={values.industry}
              onChange={(event) => update('industry', event.target.value as Industry)}
              required
            />
          </Field>

          <Field label="Website" error={fieldErrors.website} optional>
            <Input
              type="url"
              value={values.website}
              onChange={(event) => update('website', event.target.value)}
              placeholder="https://www.example.co.za"
            />
          </Field>

          <Field label="Country" error={fieldErrors.country} required>
            <Select
              options={[
                { value: 'South Africa', label: 'South Africa' },
                { value: 'Botswana', label: 'Botswana' },
                { value: 'Namibia', label: 'Namibia' },
                { value: 'Lesotho', label: 'Lesotho' },
                { value: 'Eswatini', label: 'Eswatini' },
                { value: 'Zimbabwe', label: 'Zimbabwe' },
                { value: 'Other', label: 'Other' },
              ]}
              value={values.country}
              onChange={(event) => update('country', event.target.value)}
              required
            />
          </Field>
        </div>
      </StepShell>
    </form>
  );
}
