import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Logo } from '@/components/brand/logo';
import { Card } from '@/components/ui/card';
import { ResetPasswordForm } from './reset-form';

export const metadata: Metadata = { title: 'Set a new password' };

export default function ResetPasswordPage() {
  return (
    <Card className="p-7 sm:p-8">
      <div className="mb-7 hidden lg:block">
        <Logo />
      </div>

      <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Set a new password</h1>
      <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
        Choose a password you do not use anywhere else.
      </p>

      {/* useSearchParams needs a Suspense boundary during prerendering. */}
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </Card>
  );
}
