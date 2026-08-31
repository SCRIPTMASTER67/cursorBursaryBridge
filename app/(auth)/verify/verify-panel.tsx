'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { CheckCircle, Mail } from '@/components/icons';
import { useFormSubmit } from '@/hooks/use-form-submit';

/**
 * Screen 2 of the student journey.
 *
 * Handles both halves of verification: showing "check your email" after
 * sign-up, and consuming the token when the emailed link is opened.
 */
export function VerifyPanel({
  token,
  email,
  verified,
}: {
  token: string | null;
  email: string | null;
  verified: boolean;
}) {
  const router = useRouter();
  const { submitting, error, submit } = useFormSubmit<{ redirectTo: string }>();
  const [resent, setResent] = useState(false);
  const [confirming, setConfirming] = useState(Boolean(token));
  const attempted = useRef(false);

  // Consume the token exactly once, even under React strict-mode double render.
  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    void (async () => {
      const result = await submit('/api/auth/verify', { token });
      setConfirming(false);
      if (result) {
        router.push(result.redirectTo);
        router.refresh();
      }
    })();
  }, [token, submit, router]);

  if (confirming) {
    return (
      <>
        <Icon tone="brand">
          <Mail className="h-8 w-8" />
        </Icon>
        <h1 className="mt-6 text-[22px] font-bold tracking-[-0.02em] text-ink">Verifying your email…</h1>
        <p className="mt-2 text-[13px] leading-6 text-ink-400">This will only take a moment.</p>
      </>
    );
  }

  if (verified && !token) {
    return (
      <>
        <Icon tone="success">
          <CheckCircle className="h-8 w-8" />
        </Icon>
        <h1 className="mt-6 text-[22px] font-bold tracking-[-0.02em] text-ink">Your email is verified</h1>
        <p className="mt-2 text-[13px] leading-6 text-ink-400">
          You’re all set. Let’s finish building your profile.
        </p>
        <ButtonLink href="/onboarding/student/education" fullWidth size="lg" className="mt-7">
          Continue
        </ButtonLink>
      </>
    );
  }

  return (
    <>
      <Icon tone="brand">
        <Mail className="h-8 w-8" />
      </Icon>

      <h1 className="mt-6 text-[22px] font-bold tracking-[-0.02em] text-ink">Check your email</h1>
      <p className="mt-2 text-[13px] leading-6 text-ink-400">
        We’ve sent a verification link to
        {email ? <span className="block font-semibold text-ink-700">{email}</span> : ' your email address.'}
      </p>

      {error && (
        <Alert tone="danger" className="mt-5 text-left">
          {error}
        </Alert>
      )}
      {resent && (
        <Alert tone="success" className="mt-5 text-left">
          We’ve sent a new verification link.
        </Alert>
      )}

      <div className="mt-7 space-y-3">
        <ButtonLink href="/onboarding/student/education" fullWidth size="lg">
          Continue to my profile
        </ButtonLink>
        <Button
          variant="outline"
          fullWidth
          size="lg"
          loading={submitting}
          onClick={async () => {
            const result = await submit('/api/auth/resend-verification', {});
            if (result) setResent(true);
          }}
        >
          Resend Verification Email
        </Button>
      </div>

      <p className="mt-5 text-xs leading-5 text-ink-300">
        Didn’t receive the email? Check your spam folder. In this prototype the verification link is
        printed to the server console.
      </p>
    </>
  );
}

function Icon({ children, tone }: { children: React.ReactNode; tone: 'brand' | 'success' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-success-50 text-success-600',
  } as const;
  return (
    <span className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}
