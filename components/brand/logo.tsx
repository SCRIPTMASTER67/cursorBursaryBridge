import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The Bursary-Bridge mark: an arch of three spans rising from a common base,
 * banded coral through teal, as drawn in the reference screens.
 *
 * The bands are Tailwind classes rather than hex attributes so the mark is
 * themed by the same tokens as everything else — change the palette and the
 * logo changes with it. On a dark sidebar the `light` tone keeps the same
 * shape in tints that hold up against the deep teal.
 */
export function LogoMark({
  className,
  tone = 'brand',
}: {
  className?: string;
  tone?: 'brand' | 'light';
}) {
  const bands =
    tone === 'light'
      ? ['stroke-accent-300', 'stroke-brand-300', 'stroke-white']
      : ['stroke-accent-500', 'stroke-brand-500', 'stroke-brand-700'];

  return (
    <svg viewBox="0 0 40 28" className={cn('h-7 w-10', className)} fill="none" aria-hidden="true">
      {/* Outer span to inner span, each a little shorter, like a bridge seen
          end-on — or a rainbow, which is the reading we want first. */}
      <path
        d="M3 24a17 17 0 0 1 34 0"
        className={bands[0]}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M8.5 24a11.5 11.5 0 0 1 23 0"
        className={bands[1]}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M14 24a6 6 0 0 1 12 0" className={bands[2]} strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  className,
  tone = 'brand',
  href = '/',
  showWordmark = true,
}: {
  className?: string;
  tone?: 'brand' | 'light';
  href?: string | null;
  showWordmark?: boolean;
}) {
  const content = (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark tone={tone} />
      {showWordmark && (
        <span
          className={cn(
            'text-[17px] font-bold tracking-[-0.02em]',
            tone === 'light' ? 'text-white' : 'text-ink',
          )}
        >
          Bursary-Bridge
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link
      href={href}
      className="rounded-btn focus-visible:ring-offset-0"
      aria-label="Bursary-Bridge home"
    >
      {content}
    </Link>
  );
}
