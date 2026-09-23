'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DocumentType } from '@prisma/client';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Check, Clock, FileText, Upload } from '@/components/icons';
import { documentTypeLabels } from '@/lib/labels';
import { daysUntil, formatDate } from '@/lib/utils';

/**
 * What a funder has asked this student for.
 *
 * The student sees the funder's exact words, attaches a document against each
 * item, and decides when to submit. Nothing is submitted automatically on the
 * last upload: they may want to replace a file before the funder sees it.
 */

export type RequestItem = {
  id: string;
  label: string;
  documentType: DocumentType | null;
  fulfilledAt: string | null;
  document: { id: string; fileName: string; type: DocumentType } | null;
};

export type StudentRequest = {
  id: string;
  message: string | null;
  deadline: string | null;
  status: 'OPEN' | 'RESPONDED' | 'CANCELLED';
  createdAt: string;
  respondedAt: string | null;
  organisationName: string;
  programmeName: string;
  items: RequestItem[];
};

export function InformationRequestPanel({
  request,
  documents,
}: {
  request: StudentRequest;
  documents: { id: string; fileName: string; type: DocumentType }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supplied = request.items.filter((item) => item.document).length;
  const days = daysUntil(request.deadline);
  const open = request.status === 'OPEN';

  async function act(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    try {
      const response = await fetch(`/api/student/information-requests/${request.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Could not save that.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Could not reach Bursary-Bridge. Check your connection.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className={open ? 'border-warning-100' : undefined}>
      <CardHeader
        title="Additional information required"
        description={`${request.organisationName} · ${request.programmeName}`}
        action={
          <Badge
            tone={
              request.status === 'RESPONDED'
                ? 'success'
                : request.status === 'CANCELLED'
                  ? 'neutral'
                  : 'warning'
            }
          >
            {request.status === 'RESPONDED'
              ? 'Documents submitted'
              : request.status === 'CANCELLED'
                ? 'Withdrawn'
                : 'Documents required'}
          </Badge>
        }
      />
      <CardBody className="grid gap-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {request.message && (
          <blockquote className="rounded-field border-l-2 border-brand-300 bg-surface-muted px-3.5 py-2.5 text-sm text-ink-700">
            {request.message}
          </blockquote>
        )}

        {request.deadline && open && (
          <div className="flex items-center gap-2 text-[13px]">
            <Clock className="h-4 w-4 shrink-0 text-warning-600" />
            <span className={days !== null && days < 0 ? 'text-danger-600' : 'text-ink-700'}>
              {days !== null && days < 0
                ? `The deadline was ${formatDate(request.deadline)}. Send what you can — it may still be accepted.`
                : `Respond by ${formatDate(request.deadline)}${days !== null ? ` · ${days} day${days === 1 ? '' : 's'} left` : ''}`}
            </span>
          </div>
        )}

        <div>
          <p className="text-[13px] font-medium text-ink-700">
            Requested {open && `· ${supplied} of ${request.items.length} attached`}
          </p>
          <ul className="mt-2 grid gap-2">
            {request.items.map((item) => (
              <li key={item.id} className="rounded-field border border-line bg-white p-3.5">
                <div className="flex items-start gap-2.5">
                  {item.document ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
                  ) : (
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                  )}
                  {/* The funder's exact words, not a flattened category. */}
                  <p className="min-w-0 flex-1 text-sm text-ink">{item.label}</p>
                </div>

                {item.document ? (
                  <div className="pl-6.5 mt-2.5 flex flex-wrap items-center gap-2">
                    <Badge tone="success">{item.document.fileName}</Badge>
                    {open && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busy === item.id}
                        onClick={() => act({ action: 'DETACH', itemId: item.id }, item.id)}
                      >
                        Change
                      </Button>
                    )}
                  </div>
                ) : open ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {documents.length > 0 ? (
                      <Select
                        aria-label={`Choose a document for: ${item.label}`}
                        value=""
                        onChange={(event) => {
                          if (event.target.value) {
                            void act(
                              { action: 'ATTACH', itemId: item.id, documentId: event.target.value },
                              item.id,
                            );
                          }
                        }}
                        options={[
                          { value: '', label: 'Choose one of your documents…' },
                          ...documents.map((doc) => ({
                            value: doc.id,
                            label: `${doc.fileName} (${documentTypeLabels[doc.type]})`,
                          })),
                        ]}
                      />
                    ) : (
                      <p className="text-[13px] text-ink-500">
                        You have not uploaded any documents yet.
                      </p>
                    )}
                    <ButtonLink
                      href="/student/documents"
                      variant="outline"
                      size="sm"
                      leadingIcon={<Upload className="h-4 w-4" />}
                    >
                      Upload a new one
                    </ButtonLink>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {open && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3.5">
            <Button
              loading={busy === 'submit'}
              disabled={supplied === 0}
              onClick={async () => {
                const ok = await act({ action: 'SUBMIT' }, 'submit');
                if (ok) toast.push('success', 'Your response has been sent.');
              }}
            >
              Submit response
            </Button>
            <p className="text-[13px] text-ink-500">
              {supplied === 0
                ? 'Attach at least one document before submitting.'
                : supplied < request.items.length
                  ? `You can submit now with ${supplied} of ${request.items.length}, or attach the rest first.`
                  : 'Everything requested is attached.'}
            </p>
          </div>
        )}

        {request.status === 'RESPONDED' && request.respondedAt && (
          <p className="text-[13px] text-ink-500">
            Sent {formatDate(request.respondedAt)}. {request.organisationName} is reviewing it.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
