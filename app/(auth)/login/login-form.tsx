'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useFormSubmit } from '@/hooks/use-form-submit';

export function LoginForm() {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit, clearFieldError } = useFormSubmit<{ redirectTo: string }>();
  const [values, setValues] = useState({ email: '', password: '' });

  function update(field: 'email' | 'password', value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit('/api/auth/login', values, {
      onSuccess: (data) => {
        router.push(data.redirectTo);
        router.refresh();
      },
    });
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
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          required
        />
      </Field>

      <Field label="Password" error={fieldErrors.password} required>
        <PasswordInput
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          onChange={(event) => update('password', event.target.value)}
          required
        />
      </Field>

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        Log in
      </Button>
    </form>
  );
}
