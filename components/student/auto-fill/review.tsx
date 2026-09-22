'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AutoFillFieldStatus } from '@prisma/client';
import { FIELD_STATUS, FieldStatusBadge, outstandingSummary } from './status';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ChevronLeft, ChevronRight, Spinner } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Reviewing one filled form.
 *
 * The page on the left is the real PDF as it will be downloaded, rendered from
 * the same bytes the download route produces. The panel on the right lists
 * every field with the outcome and the reason behind it. Selecting a field
 * highlights it on the page; editing one rewrites the PDF, so what is shown is
 * never out of step with what the student will send.
 */

export type ReviewField = {
  id: string;
  fieldName: string;
  label: string;
  kind: string;
  page: number;
  status: AutoFillFieldStatus;
  value: string | null;
  reason: string;
  options: string[];
  sourceDocumentName: string | null;
  sourcePage: number | null;
  sourceFieldLabel: string | null;
  rectX: number | null;
  rectY: number | null;
  rectWidth: number | null;
  rectHeight: number | null;
  editedByStudent: boolean;
};

type Props = {
  formId: string;
  fileName: string;
  fields: ReviewField[];
  fieldsTotal: number;
  fieldsFilled: number;
  fieldsOutstanding: number;
};

const HIGHLIGHT: Record<AutoFillFieldStatus, string> = {
  FILLED: 'border-success-600/70 bg-success-600/10',
  NEEDS_REVIEW: 'border-warning-600/80 bg-warning-600/15',
  MISSING: 'border-ink-400/70 bg-ink-400/10',
  AMBIGUOUS: 'border-ink-400/70 bg-ink-400/10',
  SIGNATURE: 'border-info-600/70 bg-info-600/10',
  MANUAL: 'border-info-600/70 bg-info-600/10',
};

export function AutoFillReview(props: Props) {
  const toast = useToast();
  const [fields, setFields] = useState(props.fields);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);

  const pages = useMemo(() => Math.max(1, ...fields.map((field) => field.page)), [fields]);
  const onThisPage = fields.filter((field) => field.page === page);

  // Recomputed from the fields in hand, so the header moves the moment an edit
  // is saved rather than waiting for a page reload.
  const counts = useMemo(() => {
    const filled = fields.filter((f) => f.status === 'FILLED').length;
    const toConfirm = fields.filter((f) => f.status === 'NEEDS_REVIEW').length;
    return { total: fields.length, filled, toConfirm, outstanding: fields.length - filled };
  }, [fields]);

  function applyEdit(updated: ReviewField) {
    setFields((current) => current.map((f) => (f.id === updated.id ? updated : f)));
    // The preview is rebuilt from the saved values, so it can never show
    // something different from the file that will be downloaded.
    setVersion((v) => v + 1);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <Card>
          <CardHeader
            title={props.fileName}
            description={outstandingSummary(counts)}
            action={
              pages > 1 ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-[13px] tabular-nums text-ink-600">
                    Page {page} of {pages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Next page"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : undefined
            }
          />
          <CardBody>
            <PagePreview
              formId={props.formId}
              page={page}
              version={version}
              fields={onThisPage}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </CardBody>
        </Card>
      </div>

      <div className="min-w-0">
        <Card>
          <CardHeader
            title="Every field on this form"
            description="Select a field to find it on the page. You can change anything we filled in."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {fields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  selected={field.id === selectedId}
                  onSelect={() => {
                    setSelectedId(field.id);
                    setPage(field.page);
                  }}
                  onSaved={(updated) => {
                    applyEdit(updated);
                    toast.push('success', 'Saved.');
                  }}
                />
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// --- the page ----------------------------------------------------------

function PagePreview({
  formId,
  page,
  version,
  fields,
  selectedId,
  onSelect,
}: {
  formId: string;
  page: number;
  version: number;
  fields: ReviewField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ width: number; height: number; scale: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const render = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/student/auto-fill/forms/${formId}/download`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('unavailable');
      const bytes = new Uint8Array(await response.arrayBuffer());

      // The legacy build is the one that ships type declarations and runs in
      // older browsers, which matters for students on whatever device they have.
      // Its worker is copied into `public/` at build time and loaded by URL:
      // a bundler cannot resolve it as a package path.
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const doc = await pdfjs.getDocument({
        data: bytes,
        standardFontDataUrl: '/pdf-standard-fonts/',
      }).promise;
      const pdfPage = await doc.getPage(Math.min(page, doc.numPages));
      const viewport = pdfPage.getViewport({ scale: 1.4 });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvasContext: context, viewport }).promise;

      setSize({ width: viewport.width, height: viewport.height, scale: 1.4 });
      await doc.destroy();
    } catch {
      setError('We could not show a preview of this form. You can still download it.');
    } finally {
      setLoading(false);
    }
  }, [formId, page]);

  useEffect(() => {
    void render();
    // `version` is in the dependency list so a saved edit rebuilds the page.
  }, [render, version]);

  if (error) return <Alert tone="warning">{error}</Alert>;

  return (
    <div className="relative overflow-auto rounded-panel border border-line bg-surface-muted p-3">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
          <Spinner className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      )}
      <div className="relative mx-auto w-fit shadow-card">
        <canvas ref={canvasRef} className="block bg-white" />
        {size &&
          fields.map((field) => {
            const box = boxFor(field, size);
            if (!box) return null;
            return (
              <button
                key={field.id}
                type="button"
                onClick={() => onSelect(field.id)}
                title={`${field.label} — ${FIELD_STATUS[field.status].label}`}
                aria-label={`${field.label}, ${FIELD_STATUS[field.status].label}`}
                style={box}
                className={cn(
                  'absolute rounded-[3px] border-2 transition-shadow',
                  HIGHLIGHT[field.status],
                  field.id === selectedId && 'shadow-focus ring-2 ring-brand-600',
                )}
              />
            );
          })}
      </div>
    </div>
  );
}

/**
 * Turn a PDF rectangle into a CSS box.
 *
 * PDF user space has its origin at the bottom-left of the page and CSS at the
 * top-left, so the y axis is flipped before scaling.
 */
function boxFor(
  field: ReviewField,
  size: { width: number; height: number; scale: number },
): React.CSSProperties | null {
  if (
    field.rectX === null ||
    field.rectY === null ||
    field.rectWidth === null ||
    field.rectHeight === null
  ) {
    return null;
  }
  return {
    left: field.rectX * size.scale,
    top: size.height - (field.rectY + field.rectHeight) * size.scale,
    width: field.rectWidth * size.scale,
    height: field.rectHeight * size.scale,
  };
}

// --- one field ---------------------------------------------------------

function FieldRow({
  field,
  selected,
  onSelect,
  onSaved,
}: {
  field: ReviewField;
  selected: boolean;
  onSelect: () => void;
  onSaved: (field: ReviewField) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = field.kind !== 'signature';

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/student/auto-fill/fields/${field.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: draft }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        field?: { value: string | null; status: AutoFillFieldStatus; reason: string };
      };
      if (!response.ok || !payload.field) {
        setError(payload.error ?? 'We could not save that. Please try again.');
        return;
      }
      onSaved({
        ...field,
        value: payload.field.value,
        status: payload.field.status,
        reason: payload.field.reason,
        editedByStudent: true,
      });
      setEditing(false);
    } catch {
      setError('We could not reach Bursary-Bridge. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <li
      className={cn(
        'px-5 py-3.5 transition-colors',
        selected ? 'bg-brand-50' : 'hover:bg-surface-subtle',
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-sm font-medium text-ink">{field.label}</span>
          <FieldStatusBadge status={field.status} />
        </div>
        <p className="mt-1 text-sm text-ink-700">
          {field.value ?? <span className="italic text-ink-400">Left blank</span>}
        </p>
        <p className="mt-1 text-[13px] text-ink-500">{field.reason}</p>
        {field.sourceFieldLabel && field.value && !field.editedByStudent && (
          <p className="mt-1 text-2xs text-ink-400">
            From “{field.sourceFieldLabel}”{field.sourcePage ? ` on page ${field.sourcePage}` : ''}{' '}
            of {field.sourceDocumentName}
          </p>
        )}
        {field.editedByStudent && <p className="mt-1 text-2xs text-brand-700">You changed this.</p>}
      </button>

      {editable && !editing && (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mt-2"
          onClick={() => {
            setDraft(field.value ?? '');
            setEditing(true);
            onSelect();
          }}
        >
          {field.value === null ? 'Add an answer' : 'Change this'}
        </Button>
      )}

      {editing && (
        <div className="mt-2.5">
          {field.options.length > 0 ? (
            <Select
              aria-label={field.label}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              options={[
                { value: '', label: 'Leave blank' },
                ...field.options.map((option) => ({ value: option, label: option })),
              ]}
            />
          ) : (
            <textarea
              aria-label={field.label}
              value={draft}
              rows={draft.length > 90 ? 4 : 2}
              onChange={(event) => setDraft(event.target.value)}
              className="focus:ring-brand-600/16 w-full rounded-field border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none focus:ring-2"
            />
          )}
          {error && (
            <p role="alert" className="mt-1.5 text-[13px] text-danger-600">
              {error}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Button size="sm" loading={saving} onClick={save}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
