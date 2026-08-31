'use client';

import { useState } from 'react';
import { Eye, Lock } from '@/components/icons';
import { passwordRules } from '@/lib/auth/password';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from './input';

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      type={visible ? 'text' : 'password'}
      autoComplete={props.autoComplete ?? 'new-password'}
      className={className}
      trailingSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="rounded p-1.5 text-ink-400 transition-colors hover:bg-surface-subtle hover:text-ink-600"
        >
          {visible ? <Eye className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </button>
      }
      {...props}
    />
  );
}

/**
 * Live password requirement checklist. Uses the same rules the server enforces,
 * so the user never sees a requirement the API disagrees with.
 */
export function PasswordChecklist({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  return (
    <ul className={cn('mt-2 grid grid-cols-2 gap-x-3 gap-y-1', className)}>
      {passwordRules.map((rule) => {
        const passed = rule.test(value);
        return (
          <li
            key={rule.label}
            className={cn('flex items-center gap-1.5 text-[11px]', passed ? 'text-success-600' : 'text-ink-400')}
          >
            <span
              className={cn(
                'flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold',
                passed ? 'bg-success-100 text-success-600' : 'bg-line text-ink-300',
              )}
            >
              {passed ? '✓' : '•'}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
