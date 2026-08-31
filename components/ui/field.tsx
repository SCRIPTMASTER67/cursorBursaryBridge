'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FieldContextValue = {
  id: string;
  descriptionId?: string;
  errorId?: string;
  invalid: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext() {
  return useContext(FieldContext);
}

export type FieldProps = {
  label?: string;
  /** Explains *why* we ask — a core UX requirement of the product. */
  description?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
  hint?: ReactNode;
};

/**
 * Wraps a control with its label, help text and inline error, and wires up the
 * aria-describedby / aria-invalid relationships so screen readers announce them.
 */
export function Field({
  label,
  description,
  error,
  required,
  optional,
  className,
  children,
  hint,
}: FieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <FieldContext.Provider value={{ id, descriptionId, errorId, invalid: Boolean(error) }}>
      <div className={cn('w-full', className)}>
        {label && (
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor={id} className="text-[13px] font-medium text-ink-700">
              {label}
              {required && <span className="ml-0.5 text-danger-600" aria-hidden="true"> *</span>}
              {optional && <span className="ml-1.5 font-normal text-ink-300">Optional</span>}
            </label>
            {hint}
          </div>
        )}
        {description && (
          <p id={descriptionId} className="mb-2 text-[13px] leading-5 text-ink-400">
            {description}
          </p>
        )}
        {children}
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-[13px] font-medium text-danger-600">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

/** Shared control classes so inputs, selects and textareas stay identical. */
export const controlClasses =
  'block w-full rounded-field border bg-white px-3.5 text-sm text-ink placeholder:text-ink-300 ' +
  'transition-colors focus:outline-none focus:ring-0 disabled:cursor-not-allowed ' +
  'disabled:bg-surface-subtle disabled:text-ink-300';

export const controlBorder = 'border-line hover:border-line-strong focus:border-brand-600 focus:shadow-focus';
export const controlBorderError = 'border-danger-600 focus:border-danger-600 focus:shadow-none focus:ring-2 focus:ring-danger-100';
