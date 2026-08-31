'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordChecklist, PasswordInput } from '@/components/ui/password-input';
import { useFormSubmit } from '@/hooks/use-form-submit';

type Audience = 'student' | 'organisation';

const copy: Record<Audience, { endpoint: string; notificationLabel: string; emailLabel: string; emailPlaceholder: string }> = {
  student: {
    endpoint: '/api/auth/register/student',
    notificationLabel: 'Receive bursary, scholarship and funding opportunity notifications via email',
    emailLabel: 'Email Address',
    emailPlaceholder: 'you@example.com',
  },
  organisation: {
    endpoint: '/api/auth/register/organisation',
    notificationLabel: 'Receive Bursary-Bridge notifications via email',
    emailLabel: 'Work email',
    emailPlaceholder: 'you@organisation.co.za',
  },
};

const emptyValues = {
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  password: '',
  confirmPassword: '',
  emailNotifications: true,
  acceptedTerms: false,
};

/**
 * Step 1 of both registration journeys.
 *
 * The two audiences share this form because the account fields are identical —
 * only the endpoint and two labels differ, which keeps the two flows visually
 * consistent without duplicating the validation wiring.
 */
export function AccountForm({ audience }: { audience: Audience }) {
  const router = useRouter();
  const config = copy[audience];
  const { submitting, error, fieldErrors, submit, clearFieldError } = useFormSubmit<{ redirectTo: string }>();
  const [values, setValues] = useState(emptyValues);

  function update<K extends keyof typeof emptyValues>(field: K, value: (typeof emptyValues)[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    clearFieldError(field as string);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(config.endpoint, values, {
      onSuccess: (data) => {
        router.push(data.redirectTo);
        router.refresh();
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First Name" error={fieldErrors.firstName} required>
          <Input
            name="firstName"
            autoComplete="given-name"
            value={values.firstName}
            onChange={(event) => update('firstName', event.target.value)}
            required
          />
        </Field>
        <Field label={audience === 'student' ? 'Last Name' : 'Last name'} error={fieldErrors.lastName} required>
          <Input
            name="lastName"
            autoComplete="family-name"
            value={values.lastName}
            onChange={(event) => update('lastName', event.target.value)}
            required
          />
        </Field>
      </div>

      <Field label={config.emailLabel} error={fieldErrors.email} required>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          placeholder={config.emailPlaceholder}
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          required
        />
      </Field>

      <Field label={audience === 'student' ? 'Mobile Number' : 'Mobile number'} error={fieldErrors.mobile} required>
        <Input
          type="tel"
          name="mobile"
          autoComplete="tel"
          placeholder="082 123 4567"
          value={values.mobile}
          onChange={(event) => update('mobile', event.target.value)}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" error={fieldErrors.password} required>
          <PasswordInput
            name="password"
            value={values.password}
            onChange={(event) => update('password', event.target.value)}
            required
          />
        </Field>
        <Field label={audience === 'student' ? 'Confirm Password' : 'Confirm password'} error={fieldErrors.confirmPassword} required>
          <PasswordInput
            name="confirmPassword"
            value={values.confirmPassword}
            onChange={(event) => update('confirmPassword', event.target.value)}
            required
          />
        </Field>
      </div>

      <PasswordChecklist value={values.password} />

      <div className="space-y-3 pt-1">
        <Checkbox
          name="emailNotifications"
          checked={values.emailNotifications}
          onChange={(event) => update('emailNotifications', event.target.checked)}
          label={config.notificationLabel}
        />
        <Checkbox
          name="acceptedTerms"
          checked={values.acceptedTerms}
          onChange={(event) => update('acceptedTerms', event.target.checked)}
          label={
            <>
              I agree to the Bursary-Bridge{' '}
              <Link href="/legal/terms" className="font-medium text-brand-600 hover:text-brand-700">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" className="font-medium text-brand-600 hover:text-brand-700">
                Privacy Notice
              </Link>
              .
            </>
          }
        />
        {fieldErrors.acceptedTerms && (
          <p role="alert" className="text-[13px] font-medium text-danger-600">
            {fieldErrors.acceptedTerms}
          </p>
        )}
      </div>

      <Button type="submit" fullWidth size="lg" loading={submitting} className="!mt-6">
        Create Account
      </Button>
    </form>
  );
}
