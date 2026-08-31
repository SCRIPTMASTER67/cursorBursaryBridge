'use client';

import { useCallback, useState } from 'react';

export type FormState = {
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
};

type ApiFailure = { error?: string; fields?: Record<string, string> };

/**
 * Shared submit handling for every form in the app.
 *
 * Owns the loading / error / field-error triple so each form renders the same
 * states, and turns a non-2xx response into readable copy rather than letting a
 * raw exception surface.
 */
export function useFormSubmit<TResponse = unknown>() {
  const [state, setState] = useState<FormState>({
    submitting: false,
    error: null,
    fieldErrors: {},
  });

  const submit = useCallback(
    async (
      url: string,
      body: unknown,
      options: { method?: string; onSuccess?: (data: TResponse) => void | Promise<void> } = {},
    ): Promise<TResponse | null> => {
      setState({ submitting: true, error: null, fieldErrors: {} });

      try {
        const response = await fetch(url, {
          method: options.method ?? 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const payload = (await response.json().catch(() => ({}))) as TResponse & ApiFailure;

        if (!response.ok) {
          setState({
            submitting: false,
            error: payload.error ?? 'Something went wrong. Please try again.',
            fieldErrors: payload.fields ?? {},
          });
          return null;
        }

        await options.onSuccess?.(payload as TResponse);
        // Leave `submitting` true when navigating away, so the button stays
        // disabled until the new route paints.
        setState((current) =>
          options.onSuccess ? current : { submitting: false, error: null, fieldErrors: {} },
        );
        return payload as TResponse;
      } catch {
        setState({
          submitting: false,
          error: 'We could not reach Bursary-Bridge. Check your connection and try again.',
          fieldErrors: {},
        });
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => setState({ submitting: false, error: null, fieldErrors: {} }), []);

  const clearFieldError = useCallback((field: string) => {
    setState((current) => {
      if (!current.fieldErrors[field]) return current;
      const next = { ...current.fieldErrors };
      delete next[field];
      return { ...current, fieldErrors: next };
    });
  }, []);

  return { ...state, submit, reset, clearFieldError };
}
