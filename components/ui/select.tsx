'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from '@/components/icons';
import { cn } from '@/lib/utils';
import { controlBorder, controlBorderError, controlClasses, useFieldContext } from './field';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: readonly SelectOption[];
  placeholder?: string;
  invalid?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder, invalid, ...props },
  ref,
) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <div className="relative">
      <select
        ref={ref}
        id={props.id ?? field?.id}
        aria-invalid={isInvalid || undefined}
        aria-describedby={[field?.descriptionId, field?.errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          controlClasses,
          'h-11 cursor-pointer appearance-none pr-10',
          isInvalid ? controlBorderError : controlBorder,
          !props.value && placeholder ? 'text-ink-300' : 'text-ink',
          className,
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled={props.required}>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
    </div>
  );
});
