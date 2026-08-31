'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { StepDots } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/**
 * The chrome shared by every onboarding step: back control, step dots, title,
 * "why we ask" description and the sticky action row — exactly the frame used
 * across reference screens 3 to 9.
 */
export function StepShell({
  step,
  totalSteps,
  stepLabels,
  backHref,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  step: number;
  totalSteps: number;
  stepLabels?: string[];
  backHref?: string | null;
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();

  return (
    <Card className={cn('mx-auto w-full', wide ? 'max-w-[760px]' : 'max-w-[560px]')}>
      <div className="flex items-center justify-between gap-4 px-6 pt-5 sm:px-7">
        {backHref === null ? (
          <span aria-hidden="true" className="w-14" />
        ) : (
          <button
            type="button"
            onClick={() => (backHref ? router.push(backHref) : router.back())}
            className="inline-flex items-center gap-1.5 rounded-btn px-1 py-1 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        <StepDots total={totalSteps} current={step} labels={stepLabels} />

        <span aria-hidden="true" className="w-14" />
      </div>

      <div className="px-6 pb-6 pt-6 sm:px-7">
        <h1 className="text-[21px] font-bold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {description && <p className="mt-2 text-[13px] leading-6 text-ink-400">{description}</p>}

        <div className="mt-6">{children}</div>

        <div className="mt-7">{footer}</div>
      </div>
    </Card>
  );
}

/** "Save & Exit" affordance shown beneath the primary action. */
export function SaveAndExit({ href = '/student/dashboard' }: { href?: string }) {
  return (
    <Link
      href={href}
      className="mt-3 block text-center text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
    >
      Save &amp; Exit
    </Link>
  );
}
