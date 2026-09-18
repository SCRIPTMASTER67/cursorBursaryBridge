'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useFormSubmit } from '@/hooks/use-form-submit';

export function ForgotPasswordForm() {
  const { submitting, error, fieldErrors, submit, clearFieldError } = useFormSubmit<{
    message: string;
  }>();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/auth/forgot-password',
      { email },
      { onSuccess: (data) => setSent(data.message) },
    );
  }

  // The confirmation is identical whether or not the address is registered, so
  // this screen cannot be used to find out who holds an account.
  if (sent) {
    return (
      <Alert tone="success" title="Check your email" className="mt-6">
        {sent} The link expires in one hour and can be used once.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="Email address" error={fieldErrors.email} required>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearFieldError('email');
          }}
          required
        />
      </Field>

      <Button type="submit" className="w-full" loading={submitting}>
        Send reset link
      </Button>
    </form>
  );
}
