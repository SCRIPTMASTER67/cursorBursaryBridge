'use client';

import { X } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * The selectable pill used for career interests and funder challenges, matching
 * the reference screens: unselected pills are outlined, selected pills gain the
 * brand tint and a clear affordance.
 */
export function ToggleChip({
  label,
  selected,
  onToggle,
  disabled,
  className,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled && !selected}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-btn border px-3.5 text-[13px] font-medium transition-colors',
        selected
          ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
          : 'border-line bg-white text-ink-600 hover:border-line-strong hover:bg-surface-subtle',
        disabled && !selected && 'cursor-not-allowed opacity-50 hover:border-line hover:bg-white',
        className,
      )}
    >
      {label}
      {selected && <X className="h-3.5 w-3.5" strokeWidth={2.2} />}
    </button>
  );
}

/**
 * A larger card-style multi-select tile, used for "What type of programmes do
 * you offer?" on the corporate journey.
 */
export function SelectTile({
  label,
  icon,
  selected,
  onToggle,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  selected: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'relative flex h-[108px] flex-col items-center justify-center gap-2.5 rounded-card border p-3 text-center transition-colors',
        selected
          ? 'border-brand-600 bg-brand-50/50 shadow-focus'
          : 'border-line bg-white hover:border-brand-300 hover:bg-surface-subtle',
        className,
      )}
    >
      {selected && (
        <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600">
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
            <path d="m2.5 6 2.5 2.5 4.5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <span className={cn('flex h-9 w-9 items-center justify-center', selected ? 'text-brand-600' : 'text-ink-400')}>
        {icon}
      </span>
      <span className={cn('text-[13px] font-medium leading-tight', selected ? 'text-brand-700' : 'text-ink-700')}>
        {label}
      </span>
    </button>
  );
}
