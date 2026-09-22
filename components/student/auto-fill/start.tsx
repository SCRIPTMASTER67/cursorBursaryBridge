'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';
import { Check, FileText, Trash, Upload } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Starting a job.
 *
 * Two uploads, in the order the work happens: the form the student has already
 * filled in, then the blank ones to be filled from it. Progress during
 * processing is the real number of forms finished, polled from the server —
 * there is no timer pretending to be work.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FORMS = 15;

type Phase = 'choosing' | 'uploading' | 'processing';

export function AutoFillStart() {
  const router = useRouter();
  const toast = useToast();
  const sourceInput = useRef<HTMLInputElement>(null);
  const targetsInput = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<File | null>(null);
  const [targets, setTargets] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>('choosing');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const busy = phase !== 'choosing';

  function pickSource(files: FileList | null) {
    setError(null);
    const file = files?.[0] ?? null;
    if (file && file.size > MAX_BYTES) {
      setError(`"${file.name}" is larger than 5 MB.`);
      return;
    }
    setSource(file);
  }

  function addTargets(files: FileList | null) {
    setError(null);
    if (!files) return;
    const next = [...targets];
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        setError(`"${file.name}" is larger than 5 MB and was not added.`);
        continue;
      }
      if (next.some((existing) => existing.name === file.name && existing.size === file.size)) {
        continue;
      }
      if (next.length >= MAX_FORMS) {
        setError(`You can fill in up to ${MAX_FORMS} forms at a time.`);
        break;
      }
      next.push(file);
    }
    setTargets(next);
    if (targetsInput.current) targetsInput.current.value = '';
  }

  async function run() {
    if (!source) return setError('Choose the bursary form you have already completed.');
    if (targets.length === 0) return setError('Choose at least one blank form to fill in.');

    setError(null);
    setPhase('uploading');

    try {
      const sourceBody = new FormData();
      sourceBody.append('source', source);
      const created = await fetch('/api/student/auto-fill', { method: 'POST', body: sourceBody });
      const createdPayload = (await created.json().catch(() => ({}))) as {
        error?: string;
        job?: { id: string };
      };
      if (!created.ok || !createdPayload.job) {
        setError(createdPayload.error ?? 'We could not upload your completed form.');
        setPhase('choosing');
        return;
      }

      const jobId = createdPayload.job.id;
      const targetsBody = new FormData();
      for (const file of targets) targetsBody.append('forms', file);
      const added = await fetch(`/api/student/auto-fill/${jobId}/targets`, {
        method: 'POST',
        body: targetsBody,
      });
      const addedPayload = (await added.json().catch(() => ({}))) as {
        error?: string;
        rejected?: string[];
      };
      if (!added.ok) {
        setError(addedPayload.error ?? 'We could not upload those forms.');
        setPhase('choosing');
        return;
      }
      if (addedPayload.rejected && addedPayload.rejected.length > 0) {
        toast.push('info', addedPayload.rejected[0]);
      }

      setPhase('processing');
      setProgress({ done: 0, total: targets.length });

      // Poll while the run happens, so the bar reflects forms actually
      // finished rather than an animation.
      const poll = window.setInterval(async () => {
        const state = await fetch(`/api/student/auto-fill/${jobId}`, { cache: 'no-store' });
        if (!state.ok) return;
        const payload = (await state.json()) as {
          progress: { done: number; total: number };
        };
        setProgress(payload.progress);
      }, 900);

      const processed = await fetch(`/api/student/auto-fill/${jobId}/process`, { method: 'POST' });
      window.clearInterval(poll);

      if (!processed.ok) {
        const payload = (await processed.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'We could not process your forms.');
        setPhase('choosing');
        return;
      }

      router.push(`/student/auto-fill/${jobId}`);
    } catch {
      setError('We could not reach Bursary-Bridge. Check your connection and try again.');
      setPhase('choosing');
    }
  }

  return (
    <div className="grid gap-5">
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader
          title="1. Your completed form"
          description="A bursary application you have already filled in. Everything we put on the other forms comes from this one."
        />
        <CardBody>
          <DropZone
            disabled={busy}
            onFiles={pickSource}
            inputRef={sourceInput}
            multiple={false}
            hint="One PDF, up to 5 MB"
          />
          {source && (
            <FileRow
              name={source.name}
              sizeBytes={source.size}
              onRemove={busy ? undefined : () => setSource(null)}
            />
          )}
          <p className="mt-3 text-[13px] text-ink-500">
            It must be a PDF you can select text in. A scan or a photograph of a printed form cannot
            be read, and we will tell you rather than guess at it.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="2. The forms you want filled in"
          description={`Blank bursary forms. Up to ${MAX_FORMS} at a time.`}
        />
        <CardBody>
          <DropZone
            disabled={busy}
            onFiles={addTargets}
            inputRef={targetsInput}
            multiple
            hint="PDF files, up to 5 MB each"
          />
          {targets.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {targets.map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  <FileRow
                    name={file.name}
                    sizeBytes={file.size}
                    onRemove={
                      busy ? undefined : () => setTargets(targets.filter((f) => f !== file))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {phase === 'processing' && progress && (
        <Card>
          <CardBody>
            <ProgressBar
              value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100}
              showLabel
              label={`Filling in your forms — ${progress.done} of ${progress.total} done`}
            />
            <p className="mt-2 text-[13px] text-ink-500">
              Each form is read, matched against your completed one and filled in. This usually
              takes a few seconds per form.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={run}
          loading={busy}
          disabled={busy || !source || targets.length === 0}
          leadingIcon={<Check className="h-[18px] w-[18px]" />}
        >
          {phase === 'uploading'
            ? 'Uploading…'
            : phase === 'processing'
              ? 'Filling in your forms…'
              : 'Fill in my forms'}
        </Button>
        <p className="text-[13px] text-ink-500">
          Nothing is submitted to a funder. You review every form before you download it.
        </p>
      </div>
    </div>
  );
}

function DropZone({
  onFiles,
  inputRef,
  multiple,
  hint,
  disabled,
}: {
  onFiles: (files: FileList | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  multiple: boolean;
  hint: string;
  disabled: boolean;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled) onFiles(event.dataTransfer.files);
      }}
      className={cn(
        'rounded-panel border-2 border-dashed px-6 py-8 text-center transition-colors',
        over ? 'border-brand-400 bg-brand-50' : 'border-line bg-surface-muted',
        disabled && 'opacity-60',
      )}
    >
      <Upload className="mx-auto h-6 w-6 text-brand-600" />
      <p className="mt-2 text-sm font-medium text-ink">Drag a PDF here, or</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Choose {multiple ? 'files' : 'a file'}
      </Button>
      <p className="mt-2 text-[13px] text-ink-500">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        className="sr-only"
        onChange={(event) => onFiles(event.target.files)}
      />
    </div>
  );
}

function FileRow({
  name,
  sizeBytes,
  onRemove,
}: {
  name: string;
  sizeBytes: number;
  onRemove?: () => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-field border border-line bg-white px-3 py-2">
      <FileText className="h-[18px] w-[18px] shrink-0 text-ink-400" />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
      <span className="shrink-0 text-[13px] tabular-nums text-ink-500">
        {formatSize(sizeBytes)}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="shrink-0 rounded-md p-1 text-ink-400 hover:bg-surface-subtle hover:text-danger-600"
        >
          <Trash className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
