'use client';

import { ChevronLeft, ChevronRight } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Page-number pagination. Large result sets are paged in the database, so the
 * browser never receives thousands of rows.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1 && total <= pageSize) {
    return (
      <div className={cn('flex items-center justify-end px-5 py-3.5 text-[13px] text-ink-400', className)}>
        Showing {total} of {total}
      </div>
    );
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 px-5 py-3.5 sm:flex-row',
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageButton>

        {pageRange(page, pageCount).map((entry, index) =>
          entry === 'ellipsis' ? (
            <span key={`gap-${index}`} className="px-1.5 text-[13px] text-ink-300">
              …
            </span>
          ) : (
            <PageButton
              key={entry}
              onClick={() => onPageChange(entry)}
              active={entry === page}
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? 'page' : undefined}
            >
              {entry}
            </PageButton>
          ),
        )}

        <PageButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PageButton>
      </div>

      <p className="text-[13px] text-ink-400">
        Showing {from} to {to} of {total.toLocaleString('en-ZA')}
      </p>
    </nav>
  );
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
  ...props
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] font-medium transition-colors',
        active
          ? 'bg-brand-600 text-white'
          : 'text-ink-600 hover:bg-surface-subtle disabled:pointer-events-none disabled:opacity-40',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** 1 … 4 5 6 … 26 — keeps the control a fixed width whatever the page count. */
function pageRange(page: number, pageCount: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const pages: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) pages.push('ellipsis');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < pageCount - 1) pages.push('ellipsis');
  pages.push(pageCount);

  return pages;
}
