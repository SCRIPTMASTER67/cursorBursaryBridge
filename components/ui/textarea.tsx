'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { controlBorder, controlBorderError, controlClasses, useFieldContext } from './field';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, rows = 4, ...props }, ref) {
    const field = useFieldContext();
    const isInvalid = invalid ?? field?.invalid ?? false;
    return (
      <textarea
        ref={ref}
        rows={rows}
        id={props.id ?? field?.id}
        aria-invalid={isInvalid || undefined}
        aria-describedby={[field?.descriptionId, field?.errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          controlClasses,
          'resize-y py-2.5 leading-6',
          isInvalid ? controlBorderError : controlBorder,
          className,
        )}
        {...props}
      />
    );
  },
);
