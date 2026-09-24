'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Alert, Button, Card, CardBody, Field, Select, useToast } from '@/components/ui';
import { Upload, X } from '@/components/icons';

type Programme = { id: string; name: string };

const ACCEPT = '.pdf,.zip,application/pdf,application/zip';

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Starting an import.
 *
 * The upload goes through XMLHttpRequest rather than fetch for one reason: it
 * reports progress. Sending seven hundred application forms takes long enough
 * that a button which simply says "Uploading" tells the user nothing about
 * whether anything is happening.
 */
export function ImportWizard({ programmes }: { programmes: Programme[] }) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [programmeId, setProgrammeId] = useState(programmes[0]?.id ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const accepted: File[] = [];
    const refused: string[] = [];
    for (const file of Array.from(incoming)) {
      if (/\.(pdf|zip)$/i.test(file.name)) accepted.push(file);
      else refused.push(file.name);
    }
    if (refused.length > 0) {
      toast.push(
        'error',
        `Only PDF and ZIP files can be imported. ${refused.length} file(s) were not added.`,
      );
    }
    // Same name and size twice is the accident of adding a folder twice, not
    // two applications, so it is filtered here rather than uploaded and then
    // flagged as a duplicate.
    setFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}`));
      return [...current, ...accepted.filter((file) => !seen.has(`${file.name}:${file.size}`))];
    });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  function upload() {
    if (!programmeId) {
      setError('Choose the programme these applications are for.');
      return;
    }
    if (files.length === 0) {
      setError('Add at least one PDF or ZIP file.');
      return;
    }

    setBusy(true);
    setError(null);
    setPercent(0);

    const body = new FormData();
    body.append('fundingProgrammeId', programmeId);
    for (const file of files) body.append('files', file);

    const request = new XMLHttpRequest();
    request.open('POST', '/api/corporate/imports');
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) setPercent(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      setBusy(false);
      let payload: { batchId?: string; error?: string } = {};
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        /* handled by the status check below */
      }
      if (request.status >= 200 && request.status < 300 && payload.batchId) {
        router.push(`/corporate/imports/${payload.batchId}`);
        return;
      }
      setError(payload.error ?? 'That upload could not be started. Please try again.');
    });
    request.addEventListener('error', () => {
      setBusy(false);
      setError('The upload was interrupted. Nothing was imported; please try again.');
    });
    request.send(body);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-5">
          <Field
            label="Which programme are these applications for?"
            description="Every application in this upload is scored against this programme's criteria."
          >
            <Select
              value={programmeId}
              onChange={(event) => setProgrammeId(event.target.value)}
              disabled={busy}
              options={programmes.map((programme) => ({
                value: programme.id,
                label: programme.name,
              }))}
            />
          </Field>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Application forms</p>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(event.dataTransfer.files);
              }}
              className={[
                'rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                dragging ? 'border-accent bg-accent/5' : 'border-line bg-surface-muted',
              ].join(' ')}
            >
              <Upload className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-3 text-sm font-medium text-ink">
                Drag PDF forms or a ZIP archive here
              </p>
              <p className="mt-1 text-xs text-muted">
                A ZIP with one folder per applicant keeps each form with its supporting documents.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-4"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                Choose files
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
          </div>

          {files.length > 0 && (
            <div className="rounded-lg border border-line">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <p className="text-sm font-semibold text-ink">
                  {files.length} file{files.length === 1 ? '' : 's'} ready ·{' '}
                  {readableSize(totalBytes)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setFiles([])}
                >
                  Clear all
                </Button>
              </div>
              <ul className="max-h-60 divide-y divide-line overflow-y-auto">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}:${file.size}:${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <span className="truncate text-ink">{file.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted">{readableSize(file.size)}</span>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Remove ${file.name}`}
                        className="text-muted transition-colors hover:text-danger disabled:opacity-40"
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <Alert tone="danger">{error}</Alert>}

          {busy && (
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-muted">
                <span>Uploading…</span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                Every file is stored before any of it is read, so an interruption here loses
                nothing.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" onClick={upload} disabled={busy || files.length === 0}>
              {busy ? 'Uploading…' : `Upload ${files.length || ''} and start reading`}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
