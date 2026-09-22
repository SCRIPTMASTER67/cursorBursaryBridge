import type { DisplayStatus } from '@/lib/bursary-status';
import { STATUS_COPY } from '@/lib/bursary-status';
import { cn } from '@/lib/utils';

/**
 * The status badge.
 *
 * Open is the only one that gets a strong colour and a filled dot: a student
 * scanning a list should be able to find what they can act on today without
 * reading. Closed is quiet but never hidden, and never dressed up to look
 * available.
 */

const styles: Record<DisplayStatus, string> = {
  OPEN: 'bg-success-600 text-white ring-success-600',
  UPCOMING: 'bg-info-50 text-info-700 ring-info-100',
  NEEDS_VERIFICATION: 'bg-warning-50 text-warning-700 ring-warning-100',
  UNKNOWN: 'bg-surface-subtle text-ink-600 ring-line',
  CLOSED: 'bg-surface-subtle text-ink-500 ring-line',
};

const dots: Record<DisplayStatus, string> = {
  OPEN: 'bg-white',
  UPCOMING: 'bg-info-600',
  NEEDS_VERIFICATION: 'bg-warning-600',
  UNKNOWN: 'bg-ink-400',
  CLOSED: 'bg-ink-400',
};

export function BursaryStatusBadge({
  status,
  className,
  size = 'md',
}: {
  status: DisplayStatus;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const copy = STATUS_COPY[status];
  return (
    <span
      title={copy.meaning}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide ring-1',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-2xs',
        styles[status],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dots[status])} aria-hidden="true" />
      {copy.label}
    </span>
  );
}
