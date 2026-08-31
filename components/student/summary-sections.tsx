import Link from 'next/link';
import type { SummarySection } from '@/services/student-summary';
import { cn } from '@/lib/utils';

/**
 * Renders the profile summary. Every section links back to the step that owns
 * it, so nothing is ever a dead end.
 */
export function SummarySections({
  sections,
  className,
  editLabel = 'Edit',
}: {
  sections: SummarySection[];
  className?: string;
  editLabel?: string;
}) {
  return (
    <div className={cn('divide-y divide-line overflow-hidden rounded-card border border-line bg-white', className)}>
      {sections.map((section) => (
        <section key={section.key} id={section.key} className="px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[13px] font-semibold text-ink">{section.title}</h3>
            <Link
              href={section.editHref}
              className="text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              {editLabel}
            </Link>
          </div>
          <dl className="mt-3 space-y-1.5">
            {section.rows.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-44 shrink-0 text-[13px] text-ink-400">{row.label}</dt>
                <dd className="min-w-0 text-[13px] text-ink-700">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
