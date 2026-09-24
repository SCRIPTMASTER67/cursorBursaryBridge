'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  EligibilityBadge,
  MatchBadge,
  useToast,
} from '@/components/ui';
import { AlertTriangle, ChevronDown, ExternalLink, FileText, Users } from '@/components/icons';
import type { ImportFileStatus } from '@prisma/client';

export type ReviewField = {
  canonicalKey: string;
  label: string;
  value: string;
  raw: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceFieldLabel: string;
};

export type ReviewRow = {
  id: string;
  fileName: string;
  status: ImportFileStatus;
  failureReason: string | null;
  method: string | null;
  matchScore: number | null;
  eligibilityOutcome: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'PENDING_VERIFICATION' | null;
  documentsFound: number;
  documentsRequired: number;
  identity: 'NONE' | 'ID_NUMBER' | 'EMAIL' | 'AMBIGUOUS';
  duplicateOfFileName: string | null;
  duplicateReason: string | null;
  applicantName: string;
  fields: ReviewField[];
};

type Filter = 'ALL' | 'READY' | 'NEEDS_REVIEW' | 'DUPLICATE' | 'FAILED';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'READY', label: 'Ready' },
  { key: 'NEEDS_REVIEW', label: 'Needs review' },
  { key: 'DUPLICATE', label: 'Possible duplicates' },
  { key: 'FAILED', label: 'Could not be read' },
];

const IDENTITY_LABEL: Record<ReviewRow['identity'], string> = {
  NONE: 'New applicant',
  ID_NUMBER: 'Matched on ID number',
  EMAIL: 'Matched on email',
  AMBIGUOUS: 'Needs a person to decide',
};

/** A stored boolean reads as "true"; a reviewer should see Yes or No. */
function display(value: string): string {
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  return value;
}

const CONFIDENCE_TONE = {
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'danger',
} as const;

/**
 * The review step.
 *
 * Extraction proposes; this decides. Nothing in the batch becomes an applicant
 * until Confirm is pressed, and what each row carries -- its score, its
 * eligibility, the confidence of every field, whether it looks like a
 * duplicate -- is there so the decision is made on evidence rather than on
 * trust in the extractor.
 */
export function ImportReview({
  batchId,
  rows,
  alreadyImported,
}: {
  batchId: string;
  rows: ReviewRow[];
  alreadyImported: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // A file that could not be read has nothing to import, so it is never in the
  // decision set. It stays visible, with its reason, because the organisation
  // sent it and is owed an account of what happened to it.
  const decidable = useMemo(
    () => rows.filter((row) => row.status !== 'FAILED' && row.status !== 'IMPORTED'),
    [rows],
  );

  const [chosen, setChosen] = useState<Set<string>>(
    // Ready rows are pre-selected; anything flagged starts unselected, so the
    // default action never imports something the pipeline was unsure about.
    () => new Set(decidable.filter((row) => row.status === 'READY').map((row) => row.id)),
  );

  const visible = useMemo(
    () => (filter === 'ALL' ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter],
  );

  const counts = useMemo(() => {
    const by = (status: ImportFileStatus) => rows.filter((row) => row.status === status).length;
    return {
      ALL: rows.length,
      READY: by('READY'),
      NEEDS_REVIEW: by('NEEDS_REVIEW'),
      DUPLICATE: by('DUPLICATE'),
      FAILED: by('FAILED'),
    };
  }, [rows]);

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllVisible(selected: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      for (const row of visible) {
        if (row.status === 'FAILED' || row.status === 'IMPORTED') continue;
        if (selected) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function confirm() {
    setBusy(true);
    const decisions = decidable.map((row) => ({
      fileId: row.id,
      action: chosen.has(row.id) ? ('IMPORT' as const) : ('DISCARD' as const),
    }));

    const response = await fetch(`/api/corporate/imports/${batchId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);

    if (!response.ok) {
      toast.push('error', payload.error ?? 'That import could not be completed.');
      return;
    }
    toast.push(
      'success',
      `${payload.imported} application${payload.imported === 1 ? '' : 's'} imported.`,
    );
    router.refresh();
  }

  const selectedCount = chosen.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              filter === item.key
                ? 'border-accent bg-accent text-on-accent'
                : 'border-line bg-surface text-muted hover:text-ink',
            ].join(' ')}
          >
            {item.label} {counts[item.key]}
          </button>
        ))}
      </div>

      <Card>
        {alreadyImported ? (
          <CardBody className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
            <p className="text-sm text-muted">
              This batch has been imported. Every file is listed below with what became of it,
              including any that could not be read.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(`/api/corporate/imports/${batchId}/export`, '_blank')}
            >
              Export CSV
            </Button>
          </CardBody>
        ) : (
        <CardBody className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{selectedCount}</span> of {decidable.length}{' '}
            selected to import
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAllVisible(true)}>
              Select all shown
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAllVisible(false)}>
              Deselect all shown
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(`/api/corporate/imports/${batchId}/export`, '_blank')}
            >
              Export CSV
            </Button>
            <Button size="sm" disabled={busy} onClick={() => setConfirming(true)}>
              Import {selectedCount} applicant{selectedCount === 1 ? '' : 's'}
            </Button>
          </div>
        </CardBody>
        )}

        <div className="divide-y divide-line">
          {visible.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              No files in this view.
            </p>
          )}

          {visible.map((row) => {
            const disabled = row.status === 'FAILED' || row.status === 'IMPORTED';
            const expanded = open === row.id;
            return (
              <div key={row.id}>
                <div className="flex items-start gap-3 px-5 py-3">
                  {!alreadyImported && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--accent))] disabled:opacity-30"
                    checked={chosen.has(row.id)}
                    disabled={disabled}
                    onChange={() => toggle(row.id)}
                    aria-label={`Import ${row.applicantName || row.fileName}`}
                  />
                  )}

                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : row.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={expanded}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {row.applicantName || <span className="text-muted">No name read</span>}
                      </span>
                      {row.status === 'NEEDS_REVIEW' && (
                        <Badge tone="warning">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Needs review
                        </Badge>
                      )}
                      {row.status === 'DUPLICATE' && (
                        <Badge tone="warning">
                          <Users className="mr-1 h-3 w-3" />
                          Possible duplicate
                        </Badge>
                      )}
                      {row.status === 'FAILED' && <Badge tone="danger">Could not be read</Badge>}
                      {row.status === 'IMPORTED' && <Badge tone="success">Imported</Badge>}
                      {row.status === 'DISCARDED' && <Badge tone="neutral">Left out</Badge>}
                      {row.matchScore !== null && <MatchBadge score={row.matchScore} />}
                      {row.eligibilityOutcome && (
                        <EligibilityBadge outcome={row.eligibilityOutcome} />
                      )}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="truncate">{row.fileName}</span>
                      <span>·</span>
                      <span>{IDENTITY_LABEL[row.identity]}</span>
                      {row.documentsRequired > 0 && (
                        <>
                          <span>·</span>
                          <span
                            className={
                              row.documentsFound < row.documentsRequired ? 'text-warning' : ''
                            }
                          >
                            {row.documentsFound}/{row.documentsRequired} documents
                          </span>
                        </>
                      )}
                    </span>
                  </button>

                  <a
                    href={`/api/corporate/imports/${batchId}/file/${row.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 flex shrink-0 items-center gap-1 text-xs font-semibold text-accent hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Original
                    <ExternalLink className="h-3 w-3" />
                  </a>

                  <ChevronDown
                    className={[
                      'mt-1 h-4 w-4 shrink-0 text-muted transition-transform',
                      expanded ? 'rotate-180' : '',
                    ].join(' ')}
                  />
                </div>

                {expanded && (
                  <div className="border-t border-line bg-surface-muted px-5 py-4">
                    {row.failureReason && (
                      <Alert tone="danger" className="mb-3">
                        {row.failureReason}
                      </Alert>
                    )}
                    {row.duplicateReason && (
                      <Alert tone="warning" className="mb-3">
                        {row.duplicateReason}
                        {row.duplicateOfFileName && <> Compare with {row.duplicateOfFileName}.</>}{' '}
                        Nothing has been merged or removed; importing both is your decision.
                      </Alert>
                    )}

                    {row.fields.length === 0 ? (
                      <p className="text-sm text-muted">
                        No fields were read from this document.
                      </p>
                    ) : (
                      <>
                        <p className="mb-2 text-xs text-muted">
                          Read from the form
                          {row.method === 'acroform'
                            ? ' using its own form fields'
                            : row.method === 'text-layout'
                              ? ' by reading the page text, which is less certain than a real form field'
                              : ''}
                          . A field the extractor was not sure of is marked, and an empty one was
                          left empty rather than guessed at.
                        </p>
                        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                          {row.fields.map((field) => (
                            <div
                              key={field.canonicalKey}
                              className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-1.5"
                            >
                              <dt className="text-xs text-muted">{field.label}</dt>
                              <dd className="flex items-center gap-2 text-right">
                                <span className="text-sm text-ink">{display(field.value) || '—'}</span>
                                {field.confidence !== 'HIGH' && (
                                  <Badge tone={CONFIDENCE_TONE[field.confidence]}>
                                    {field.confidence === 'LOW' ? 'Low' : 'Medium'}
                                  </Badge>
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title={`Import ${selectedCount} applicant${selectedCount === 1 ? '' : 's'}?`}
        message={
          `${selectedCount} will become applicants against this programme. ` +
          `${decidable.length - selectedCount} will be left out; their uploaded files are kept ` +
          `either way and nothing is deleted.`
        }
        confirmLabel={busy ? 'Importing…' : 'Import'}
        onConfirm={confirm}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
