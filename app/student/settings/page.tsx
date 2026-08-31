import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { AccountSettings } from '@/components/shared/account-settings';
import { requireOnboardedStudent } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Settings' };

export default async function StudentSettingsPage() {
  const { user } = await requireOnboardedStudent();

  return (
    <PageBody>
      <PageHeader title="Settings" description="Manage your account details and password." />
      <AccountSettings
        initial={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          mobile: user.mobile ?? '',
          emailNotifications: user.emailNotifications,
          emailVerified: Boolean(user.emailVerifiedAt),
        }}
      />
    </PageBody>
  );
}
