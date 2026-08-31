'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CorporateRole, OrganisationSize } from '@prisma/client';
import { StepShell } from '@/components/onboarding/step-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { corporateRoleLabels, organisationSizeLabels, toOptions } from '@/lib/labels';
import { corporateSteps } from '@/lib/onboarding-steps';

const stepLabels = corporateSteps.map((s) => s.label);

/** Corporate step 2 — Your Role. */
export function CorporateRoleForm({
  initial,
}: {
  initial: { role: CorporateRole | null; organisationSize: OrganisationSize | null; department: string };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit } = useFormSubmit<{ redirectTo: string }>();
  const [values, setValues] = useState({
    role: initial.role ?? '',
    organisationSize: initial.organisationSize ?? '',
    department: initial.department,
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/corporate/onboarding',
      {
        step: 'role',
        data: {
          role: values.role || undefined,
          organisationSize: values.organisationSize || undefined,
          department: values.department,
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
        step={2}
        totalSteps={corporateSteps.length}
        stepLabels={stepLabels}
        backHref="/onboarding/organisation/details"
        title="Your role in the organisation"
        description="What best describes your role? This helps us tailor the tools we show you."
        footer={
          <Button type="submit" fullWidth size="lg" loading={submitting}>
            Continue
          </Button>
        }
      >
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        <div className="space-y-5">
          <Field label="Role" error={fieldErrors.role} required>
            <Select
              options={toOptions(corporateRoleLabels)}
              placeholder="Select your role"
              value={values.role}
              onChange={(event) => setValues({ ...values, role: event.target.value as CorporateRole })}
              required
            />
          </Field>

          <Field label="How large is your organisation?" error={fieldErrors.organisationSize} required>
            <Select
              options={toOptions(organisationSizeLabels)}
              placeholder="Select organisation size"
              value={values.organisationSize}
              onChange={(event) =>
                setValues({ ...values, organisationSize: event.target.value as OrganisationSize })
              }
              required
            />
          </Field>

          <Field label="Which best describes your department?" error={fieldErrors.department} optional>
            <Input
              value={values.department}
              onChange={(event) => setValues({ ...values, department: event.target.value })}
              placeholder="e.g. Corporate Social Investment / CSI"
            />
          </Field>
        </div>
      </StepShell>
    </form>
  );
}
