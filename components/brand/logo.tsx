import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The Bursary-Bridge mark: a stylised bridge span, drawn to match the
 * reference designs. `tone` switches it for dark sidebars.
 */
export function LogoMark({ className, tone = 'brand' }: { className?: string; tone?: 'brand' | 'light' }) {
  const stroke = tone === 'light' ? '#FFFFFF' : '#12132B';
  const accent = tone === 'light' ? '#FFFFFF' : '#5B2EDB';
  return (
    <svg viewBox="0 0 40 28" className={cn('h-7 w-10', className)} fill="none" aria-hidden="true">
      <path d="M2 25h36" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M20 3 4 25M20 3l16 22" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <path d="M20 3v22" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <path d="M11.6 13.5h16.8M8 19h24" stroke={accent} strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
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
    <Link href={href} className="rounded-btn focus-visible:ring-offset-0" aria-label="Bursary-Bridge home">
      {content}
    </Link>
  );
}
