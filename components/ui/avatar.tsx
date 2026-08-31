import { cn } from '@/lib/utils';
import { initials as toInitials } from '@/lib/utils';

const sizes = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-10 w-10 text-[13px]',
  lg: 'h-14 w-14 text-base',
  xl: 'h-16 w-16 text-lg',
} as const;

/**
 * Initials avatar. The prototype has no user photography, so a deterministic
 * tinted circle stands in — stable per person rather than random.
 */
export function Avatar({
  firstName,
  lastName,
  size = 'md',
  className,
  tone,
}: {
  firstName: string;
  lastName: string;
  size?: keyof typeof sizes;
  className?: string;
  tone?: 'brand' | 'neutral';
}) {
  const palette = [
    'bg-brand-100 text-brand-700',
    'bg-info-100 text-info-700',
    'bg-success-100 text-success-700',
    'bg-warning-100 text-warning-700',
  ];
  const seed = `${firstName}${lastName}`.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const colour = tone === 'neutral' ? 'bg-surface-subtle text-ink-600' : palette[seed % palette.length];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizes[size],
        colour,
        className,
      )}
      aria-hidden="true"
    >
      {toInitials(firstName, lastName)}
    </span>
  );
}

/** Square logo tile used for organisations. */
export function OrgAvatar({ name, size = 'md', className }: { name: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[10px] bg-brand-50 font-bold text-brand-600',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
