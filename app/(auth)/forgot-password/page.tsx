import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Card } from '@/components/ui/card';
import { ForgotPasswordForm } from './forgot-form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <Card className="p-7 sm:p-8">
      <div className="mb-7 hidden lg:block">
        <Logo />
      </div>

      <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Reset your password</h1>
      <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
        Enter the address you signed up with and we will send you a link to set a new password.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-[13px] text-ink-400">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </Card>
  );
}
