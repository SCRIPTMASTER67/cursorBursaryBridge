'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle, InfoCircle, X } from '@/components/icons';
import { cn } from '@/lib/utils';

type Toast = { id: number; tone: 'success' | 'error' | 'info'; message: string };

const ToastContext = createContext<{ push: (tone: Toast['tone'], message: string) => void } | null>(null);

/** Transient confirmation of an action, e.g. "Preference removed". */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: Toast['tone'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const icons = {
    success: <CheckCircle className="h-[18px] w-[18px] text-success-600" />,
    error: <AlertCircle className="h-[18px] w-[18px] text-danger-600" />,
    info: <InfoCircle className="h-[18px] w-[18px] text-info-600" />,
  };

  return (
    <div
      className={cn(
        'pointer-events-auto flex animate-fade-in items-start gap-3 rounded-field border border-line bg-white px-4 py-3 shadow-float',
      )}
    >
      {icons[toast.tone]}
      <p className="flex-1 text-[13px] leading-5 text-ink-700">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded p-0.5 text-ink-300 hover:text-ink-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  // Falling back to a no-op keeps components usable outside the provider.
  return context ?? { push: () => undefined };
}
