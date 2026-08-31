'use client';

import { cn } from '@/lib/utils';

export type TabItem = { key: string; label: string; count?: number };

/**
 * Underlined tab bar used on the opportunity detail, applicant profile and
 * applications screens. Rendered as a real tablist for assistive technology.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-line', className)}>
      <div role="tablist" className="no-scrollbar flex gap-6 overflow-x-auto">
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-0.5 pb-3 pt-1 text-[13px] font-medium transition-colors',
                selected
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-ink-400 hover:border-line-strong hover:text-ink-600',
              )}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className={cn('ml-1.5 tabular-nums', selected ? 'text-brand-500' : 'text-ink-300')}>
                  ({tab.count.toLocaleString('en-ZA')})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
