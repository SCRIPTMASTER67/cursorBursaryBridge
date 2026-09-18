'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { useFormSubmit } from '@/hooks/use-form-submit';

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const { submitting, error, fieldErrors, submit, clearFieldError } = useFormSubmit<{
    redirectTo: string;
  }>();
  const [values, setValues] = useState({ newPassword: '', confirmPassword: '' });
  const [done, setDone] = useState(false);

  function update(field: 'newPassword' | 'confirmPassword', value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/auth/reset-password',
      { token, ...values },
      { onSuccess: () => setDone(true) },
    );
  }

  if (!token) {
    return (
      <Alert tone="danger" title="This link is incomplete" className="mt-6">
        It is missing its token.{' '}
        <Link href="/forgot-password" className="font-semibold underline">
          Request a new link
        </Link>
        .
      </Alert>
    );
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <Alert tone="success" title="Password updated">
          You can now sign in with your new password. Any other sessions have been signed out.
        </Alert>
        <Button className="w-full" onClick={() => router.push('/login')}>
          Go to log in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error && (
        <Alert tone="danger">
          {error}{' '}
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
          .
        </Alert>
      )}

      <Field label="New password" error={fieldErrors.newPassword} required>
        <PasswordInput
          name="newPassword"
          autoComplete="new-password"
          placeholder="Choose a new password"
          value={values.newPassword}
          onChange={(event) => update('newPassword', event.target.value)}
          required
        />
      </Field>

      <Field label="Confirm new password" error={fieldErrors.confirmPassword} required>
        <PasswordInput
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Enter it again"
          value={values.confirmPassword}
          onChange={(event) => update('confirmPassword', event.target.value)}
          required
        />
      </Field>

      <Button type="submit" className="w-full" loading={submitting}>
        Set new password
      </Button>
    </form>
  );
}
