'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';

/**
 * An administrative action that requires a written reason.
 *
 * The reason is not decoration: it is what makes the entry in the audit log
 * reviewable afterwards, so the button cannot submit without one. Validation
 * is repeated on the server, which remains the source of truth.
 */
export function ReasonAction({
  endpoint,
  payload,
  label,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  disabled,
}: {
  endpoint: string;
  payload: Record<string, unknown>;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = reason.trim().length < 10;

  async function submit() {
    if (tooShort) {
      setError('Give a reason of at least 10 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, reason: reason.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'That action could not be completed.');
        return;
      }
      toast.push('success', `${label} completed.`);
      setOpen(false);
      setReason('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={tone === 'danger' ? 'danger' : 'primary'}
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title={title}
        description={description}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              size="sm"
              onClick={submit}
              disabled={busy || tooShort}
            >
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        }
      >
        <label className="block text-[13px] font-medium text-ink-700" htmlFor="reason">
          Reason (recorded in the audit log)
        </label>
        <Textarea
          id="reason"
          name="reason"
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain why this action is being taken."
          className="mt-1.5"
        />
        {error ? <p className="mt-2 text-[13px] text-danger-600">{error}</p> : null}
      </Modal>
    </>
  );
}
