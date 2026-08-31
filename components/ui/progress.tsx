import { Check } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * The dotted step indicator across the top of every onboarding screen, taken
 * from the reference designs: completed steps are filled, the current step is
 * filled and slightly larger, upcoming steps are muted.
 */
export function StepDots({
  total,
  current,
  className,
  labels,
}: {
  total: number;
  current: number;
  className?: string;
  labels?: string[];
}) {
  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Step ${current} of ${total}${labels?.[current - 1] ? `: ${labels[current - 1]}` : ''}`}
    >
      {Array.from({ length: total }).map((_, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <span key={step} className="flex items-center gap-1.5">
            <span
              className={cn(
                'block rounded-full transition-colors',
                active ? 'h-2.5 w-2.5 bg-brand-600' : done ? 'h-2 w-2 bg-brand-600' : 'h-2 w-2 bg-line-strong',
              )}
            />
            {step < total && (
              <span className={cn('block h-[2px] w-5 rounded-full', done ? 'bg-brand-600' : 'bg-line')} />
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Horizontal bar used for profile strength and programme fill rates. */
export function ProgressBar({
  value,
  className,
  tone = 'brand',
  showLabel = false,
  label,
}: {
  value: number;
  className?: string;
  tone?: 'brand' | 'success' | 'warning';
  showLabel?: boolean;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tones = {
    brand: 'bg-brand-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
  } as const;

  return (
    <div className={className}>
      {showLabel && (
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-ink-600">{label ?? 'Progress'}</span>
          <span className="text-[13px] font-semibold tabular-nums text-ink">{clamped}%</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The numbered vertical stepper used by the corporate programme builder.
 */
export function VerticalSteps({
  steps,
  current,
  className,
}: {
  steps: { key: string; label: string }[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn('space-y-1', className)}>
      {steps.map((step, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <li key={step.key} className="flex items-center gap-3 rounded-btn px-2 py-2.5">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
                done
                  ? 'bg-brand-600 text-white'
                  : active
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-subtle text-ink-400 ring-1 ring-inset ring-line',
              )}
            >
              {done ? <Check className="h-3 w-3" strokeWidth={3} /> : number}
            </span>
            <span
              className={cn(
                'text-[13px]',
                active ? 'font-semibold text-ink' : done ? 'font-medium text-ink-600' : 'text-ink-400',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
