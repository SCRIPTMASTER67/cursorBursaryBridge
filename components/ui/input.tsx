'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { controlBorder, controlBorderError, controlClasses, useFieldContext } from './field';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leadingIcon, trailingSlot, invalid, ...props },
  ref,
) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;

  const control = (
    <input
      ref={ref}
      id={props.id ?? field?.id}
      aria-invalid={isInvalid || undefined}
      aria-describedby={[field?.descriptionId, field?.errorId].filter(Boolean).join(' ') || undefined}
      className={cn(
        controlClasses,
        'h-11',
        isInvalid ? controlBorderError : controlBorder,
        leadingIcon && 'pl-10',
        trailingSlot && 'pr-11',
        className,
      )}
      {...props}
    />
  );

  if (!leadingIcon && !trailingSlot) return control;

  return (
    <div className="relative">
      {leadingIcon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300">
          {leadingIcon}
        </span>
      )}
      {control}
      {trailingSlot && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400">{trailingSlot}</span>
      )}
    </div>
  );
});

/** Percentage input with a fixed "%" affix, used for academic averages. */
export const PercentInput = forwardRef<HTMLInputElement, InputProps>(function PercentInput(
  { className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <Input
        ref={ref}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        className={cn('pr-10', className)}
        {...props}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-400">
        %
      </span>
    </div>
  );
});
