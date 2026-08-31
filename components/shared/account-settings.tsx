'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordChecklist, PasswordInput } from '@/components/ui/password-input';
import { useToast } from '@/components/ui/toast';
import { useFormSubmit } from '@/hooks/use-form-submit';

/** Account details and password management, shared by both roles. */
export function AccountSettings({
  initial,
}: {
  initial: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    emailNotifications: boolean;
    emailVerified: boolean;
  };
}) {
  const router = useRouter();
  const toast = useToast();

  const details = useFormSubmit<{ message?: string }>();
  const password = useFormSubmit<{ redirectTo: string; message?: string }>();

  const [values, setValues] = useState({
    firstName: initial.firstName,
    lastName: initial.lastName,
    email: initial.email,
    mobile: initial.mobile,
    emailNotifications: initial.emailNotifications,
  });

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    const result = await details.submit('/api/student/settings', values, { method: 'PUT' });
    if (result) {
      toast.push('success', result.message ?? 'Your details have been updated.');
      router.refresh();
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    await password.submit(
      '/api/student/settings',
      { intent: 'password', ...passwords },
      {
        method: 'PUT',
        onSuccess: (data) => {
          router.push(data.redirectTo);
          router.refresh();
        },
      },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader title="Account details" description="Used to identify you and to reach you." />
        <form onSubmit={saveDetails} className="space-y-4 px-6 pb-6" noValidate>
          {details.error && <Alert tone="danger">{details.error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={details.fieldErrors.firstName} required>
              <Input
                value={values.firstName}
                onChange={(event) => setValues({ ...values, firstName: event.target.value })}
              />
            </Field>
            <Field label="Last name" error={details.fieldErrors.lastName} required>
              <Input
                value={values.lastName}
                onChange={(event) => setValues({ ...values, lastName: event.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Email address"
            error={details.fieldErrors.email}
            required
            description={
              initial.emailVerified
                ? undefined
                : 'This address has not been verified yet. Check your inbox for the verification link.'
            }
          >
            <Input
              type="email"
              value={values.email}
              onChange={(event) => setValues({ ...values, email: event.target.value })}
            />
          </Field>

          <Field label="Mobile number" error={details.fieldErrors.mobile} required>
            <Input
              type="tel"
              value={values.mobile}
              onChange={(event) => setValues({ ...values, mobile: event.target.value })}
            />
          </Field>

          <Checkbox
            checked={values.emailNotifications}
            onChange={(event) => setValues({ ...values, emailNotifications: event.target.checked })}
            label="Receive Bursary-Bridge notifications via email"
          />

          <Button type="submit" loading={details.submitting}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Password"
          description="Changing your password signs you out of every device."
        />
        <form onSubmit={changePassword} className="space-y-4 px-6 pb-6" noValidate>
          {password.error && <Alert tone="danger">{password.error}</Alert>}

          <Field label="Current password" error={password.fieldErrors.currentPassword} required>
            <PasswordInput
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
            />
          </Field>

          <Field label="New password" error={password.fieldErrors.newPassword} required>
            <PasswordInput
              value={passwords.newPassword}
              onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
            />
          </Field>

          <PasswordChecklist value={passwords.newPassword} />

          <Field label="Confirm new password" error={password.fieldErrors.confirmPassword} required>
            <PasswordInput
              value={passwords.confirmPassword}
              onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })}
            />
          </Field>

          <Button type="submit" loading={password.submitting}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
