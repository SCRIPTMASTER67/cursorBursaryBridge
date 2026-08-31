import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Card } from '@/components/ui/card';
import { getCurrentUser, homePathForRole } from '@/lib/auth/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <Card className="p-7 sm:p-8">
      <div className="mb-7 hidden lg:block">
        <Logo />
      </div>

      <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Welcome back</h1>
      <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
        Log in to see your matched opportunities and track your applications.
      </p>

      <LoginForm />

      <p className="mt-6 text-center text-[13px] text-ink-400">
        Don’t have an account?{' '}
        <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign up
        </Link>
      </p>
    </Card>
  );
}
