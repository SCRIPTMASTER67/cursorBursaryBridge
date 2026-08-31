import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Card } from '@/components/ui/card';
import { AccountForm } from '@/components/onboarding/account-form';
import { getCurrentUser, homePathForRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Create your student account' };

export default async function StudentRegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <Card className="p-7 sm:p-8">
      <div className="mb-7 hidden lg:block">
        <Logo />
      </div>

      <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Create your account</h1>
      <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
        Create your account to discover funding opportunities matched to your education journey.
      </p>

      <AccountForm audience="student" />

      <p className="mt-6 text-center text-[13px] text-ink-400">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </Card>
  );
}
