'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check } from '@/components/icons';
import { cn } from '@/lib/utils';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  label: ReactNode;
  description?: string;
};

/**
 * Checkbox with a custom indicator. The native input stays in the DOM (visually
 * hidden but focusable) so keyboard and screen-reader behaviour is unchanged.
 */
export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          id={inputId}
          type="checkbox"
          className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border border-line-strong
                     bg-white transition-colors checked:border-brand-600 checked:bg-brand-600
                     hover:border-brand-400 disabled:cursor-not-allowed disabled:bg-surface-subtle"
          {...props}
        />
        <Check
          className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      <label htmlFor={inputId} className="cursor-pointer select-none text-[13px] leading-[18px] text-ink-700">
        {label}
        {description && <span className="mt-0.5 block text-[13px] text-ink-400">{description}</span>}
      </label>
    </div>
  );
}

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
  description?: string;
};

export function Radio({ label, description, className, id, ...props }: RadioProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          id={inputId}
          type="radio"
          className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-full border border-line-strong
                     bg-white transition-colors checked:border-[5px] checked:border-brand-600
                     hover:border-brand-400 disabled:cursor-not-allowed disabled:bg-surface-subtle"
          {...props}
        />
      </span>
      <label htmlFor={inputId} className="cursor-pointer select-none text-[13px] leading-[18px] text-ink-700">
        {label}
        {description && <span className="mt-0.5 block text-[13px] text-ink-400">{description}</span>}
      </label>
    </div>
  );
}

/** A radio rendered as a bordered card — used for prominent single choices. */
export function RadioCard({
  label,
  description,
  checked,
  className,
  ...props
}: RadioProps & { checked?: boolean }) {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-field border p-3.5 transition-colors',
        checked ? 'border-brand-600 bg-brand-50/60 shadow-focus' : 'border-line bg-white hover:border-brand-300',
        className,
      )}
    >
      <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          id={inputId}
          type="radio"
          checked={checked}
          className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-full border border-line-strong
                     bg-white checked:border-[5px] checked:border-brand-600"
          {...props}
        />
      </span>
      <span className="text-[13px] leading-[18px]">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="mt-1 block text-ink-400">{description}</span>}
      </span>
    </label>
  );
}
