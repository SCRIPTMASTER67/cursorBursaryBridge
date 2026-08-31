'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';

/**
 * Root error boundary. Users never see a stack trace — only plain language and
 * a way to recover. The detail is logged for developers instead.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[bursary-bridge] unhandled error', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-10" />
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink-400">
        We hit an unexpected problem loading this page. Your information is safe — please try again.
      </p>
      {error.digest && <p className="mt-3 text-xs text-ink-300">Reference: {error.digest}</p>}
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.assign('/')}>
          Back to home
        </Button>
      </div>
    </main>
  );
}
