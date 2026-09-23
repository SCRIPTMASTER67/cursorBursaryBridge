'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DocumentType } from '@prisma/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { Plus, Trash } from '@/components/icons';
import { documentTypeLabels } from '@/lib/labels';

/**
 * Asking an applicant for something specific.
 *
 * The common documents are offered as one-tap additions because most requests
 * are for one of them, but they are only a shortcut: every item is editable
 * text, and a reviewer can type whatever they actually need. A funder asking
 * for "a certified copy of your latest university academic record" gets
 * exactly that stored, not "Academic record".
 */

const COMMON: { type: DocumentType; label: string }[] = [
  { type: 'ACADEMIC_RECORD', label: 'Latest academic transcript' },
  { type: 'PROOF_OF_REGISTRATION', label: 'Proof of registration' },
  { type: 'ID_DOCUMENT', label: 'Certified copy of your ID' },
  { type: 'PROOF_OF_RESIDENCE', label: 'Proof of residence' },
  { type: 'PROOF_OF_INCOME', label: 'Parent or guardian proof of income' },
  { type: 'MATRIC_CERTIFICATE', label: 'Matric certificate' },
];

type Item = { key: string; label: string; documentType: DocumentType | null };

let nextKey = 0;
const newKey = () => `item-${(nextKey += 1)}`;

export function RequestInformationDialog({
  applicationId,
  applicantName,
  open,
  onClose,
}: {
  applicationId: string;
  applicantName: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([{ key: newKey(), label: '', documentType: null }]);
  const [message, setMessage] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCommon(entry: { type: DocumentType; label: string }) {
    setItems((current) => {
      if (current.some((item) => item.documentType === entry.type)) return current;
      // Replace the empty starter row rather than leaving a blank behind.
      const withoutEmpty = current.filter((item) => item.label.trim() !== '');
      return [...withoutEmpty, { key: newKey(), label: entry.label, documentType: entry.type }];
    });
  }

  const usable = items.filter((item) => item.label.trim().length >= 3);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/corporate/applications/${applicationId}/information-requests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: usable.map((item) => ({
              label: item.label.trim(),
              documentType: item.documentType ?? undefined,
            })),
            message: message.trim() || undefined,
            deadline: deadline || undefined,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok) {
        setError(payload.fields?.deadline ?? payload.error ?? 'Could not send the request.');
        return;
      }
      toast.push('success', `Request sent to ${applicantName}.`);
      onClose();
      router.refresh();
    } catch {
      setError('Could not reach Bursary-Bridge. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request information from applicant"
      description={`${applicantName} is told exactly what you need and can upload it against each item. Their application moves to “Documents required” until they respond.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={send} loading={busy} disabled={usable.length === 0}>
            Send request
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}

      <div className="grid gap-4">
        <div>
          <p className="text-[13px] font-medium text-ink-700">
            What do you need from this applicant?
          </p>
          <p className="mt-0.5 text-[13px] text-ink-500">
            Each item becomes something they can upload against. Type whatever you need — these are
            not limited to a fixed list.
          </p>

          <ul className="mt-2.5 grid gap-2">
            {items.map((item, index) => (
              <li key={item.key} className="flex items-start gap-2">
                <Input
                  value={item.label}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((row) =>
                        row.key === item.key
                          ? // Editing the text makes it the reviewer's own wording,
                            // so it is no longer tied to a predefined type.
                            { ...row, label: event.target.value, documentType: null }
                          : row,
                      ),
                    )
                  }
                  placeholder={
                    index === 0
                      ? 'e.g. Please provide a certified copy of your latest academic record'
                      : 'Another item'
                  }
                  aria-label={`Requested item ${index + 1}`}
                />
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setItems((current) => current.filter((row) => row.key !== item.key))
                    }
                    aria-label={`Remove item ${index + 1}`}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mt-1.5"
            onClick={() =>
              setItems((current) => [...current, { key: newKey(), label: '', documentType: null }])
            }
            leadingIcon={<Plus className="h-4 w-4" />}
          >
            Add custom requirement
          </Button>
        </div>

        <div>
          <p className="text-[13px] font-medium text-ink-700">Common requests</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {COMMON.map((entry) => {
              const already = items.some((item) => item.documentType === entry.type);
              return (
                <button
                  key={entry.type}
                  type="button"
                  disabled={already}
                  onClick={() => addCommon(entry)}
                  className="rounded-btn px-2.5 py-1.5 text-[13px] font-medium text-ink-600 ring-1 ring-line transition-colors hover:bg-surface-subtle disabled:opacity-40"
                  title={documentTypeLabels[entry.type]}
                >
                  {already ? '✓ ' : '+ '}
                  {entry.label}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Message" optional hint="Why you need this. Shown to the applicant.">
          <Textarea
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Please provide these documents so we can complete your application review."
          />
        </Field>

        <Field label="Response deadline" optional>
          <Input
            type="date"
            value={deadline}
            min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
