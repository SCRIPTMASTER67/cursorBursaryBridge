'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, CardBody, useToast } from '@/components/ui';
import { Spinner } from '@/components/icons';

type Status = {
  status: string;
  totalFiles: number;
  processedFiles: number;
  readyCount: number;
  reviewCount: number;
  duplicateCount: number;
  failedCount: number;
  failureReason: string | null;
};

/**
 * What is happening to the batch, while it happens.
 *
 * Polls rather than streams, because the counters it reads are recomputed from
 * the files themselves and a two-second lag on a job that takes minutes costs
 * nothing. When extraction finishes the page is refreshed so the server can
 * render the review table.
 */
/**
 * How many times the screen will pick a stalled batch back up on its own
 * before asking. Each attempt covers one invocation's worth of reading, so
 * this is generous enough for a large batch and still bounded, so a batch that
 * cannot progress stops retrying instead of looping forever.
 */
const MAX_AUTO_RESUMES = 30;

export function ImportProgress({ batchId, initial }: { batchId: string; initial: Status }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState(initial);
  const [resuming, setResuming] = useState(false);
  const [stalled, setStalled] = useState(false);
  const autoResumes = useRef(0);

  useEffect(() => {
    if (state.status !== 'EXTRACTING' && state.status !== 'UPLOADING') return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/corporate/imports/${batchId}/status`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const next: Status = await response.json();
        if (cancelled) return;
        // Extraction runs in the application process, so a restart part way
        // through leaves the counter still. Two minutes without a file being
        // read is long enough to offer the remedy rather than spin forever.
        setStalled((was) => (next.processedFiles === state.processedFiles ? was : false));
        setState(next);
        if (next.status !== 'EXTRACTING' && next.status !== 'UPLOADING') {
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // A dropped poll is not a failure of the import: the work continues on
        // the server, and the next tick picks the progress back up.
      }
    }, 2000);

    // Two minutes without a single file being read means the reader stopped.
    // On a serverless platform that is ordinary rather than exceptional: the
    // invocation is capped, so a large batch is cut off part way through and
    // has to be picked up again. Making somebody click a button once a minute
    // to finish one import is not a workflow, so the screen resumes itself and
    // only asks for help if it is still stuck after many attempts -- at which
    // point something is wrong that retrying will not fix.
    const stall = setTimeout(() => {
      if (cancelled) return;
      if (autoResumes.current >= MAX_AUTO_RESUMES) {
        setStalled(true);
        return;
      }
      autoResumes.current += 1;
      void resume({ silent: true });
    }, 120_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(stall);
    };
  }, [batchId, state.status, state.processedFiles, router]);

  async function resume({ silent = false }: { silent?: boolean } = {}) {
    setResuming(true);
    const response = await fetch(`/api/corporate/imports/${batchId}/resume`, { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    setResuming(false);
    if (!response.ok) {
      // A batch that finished between the stall firing and this request is not
      // a failure worth interrupting anybody over.
      if (!silent) toast.push('error', payload.error ?? 'That import could not be resumed.');
      return;
    }
    setStalled(false);
    if (!silent) toast.push('success', `Reading resumed on ${payload.pending} file(s).`);
  }

  const percent =
    state.totalFiles === 0 ? 0 : Math.round((state.processedFiles / state.totalFiles) * 100);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-2">
          <Spinner className="h-4 w-4 animate-spin text-accent" />
          <p className="text-sm font-semibold text-ink">
            Reading {state.totalFiles} application{state.totalFiles === 1 ? '' : 's'}…
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>
              {state.processedFiles} of {state.totalFiles} read
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Ready', value: state.readyCount, tone: 'text-success' },
            { label: 'Needs review', value: state.reviewCount, tone: 'text-warning' },
            { label: 'Possible duplicates', value: state.duplicateCount, tone: 'text-warning' },
            { label: 'Could not be read', value: state.failedCount, tone: 'text-danger' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-line px-3 py-2">
              <dt className="text-xs text-muted">{item.label}</dt>
              <dd className={`text-lg font-bold ${item.tone}`}>{item.value}</dd>
            </div>
          ))}
        </dl>

        {state.failureReason && <Alert tone="danger">{state.failureReason}</Alert>}

        {stalled && (
          <Alert tone="warning">
            <p>
              Nothing has been read for a couple of minutes. If the server restarted while this
              batch was being read, the files that were not reached are still waiting. Resuming
              picks up only those; nothing already read is read again.
            </p>
            <Button size="sm" className="mt-2" disabled={resuming} onClick={() => void resume()}>
              {resuming ? 'Resuming…' : 'Resume reading'}
            </Button>
          </Alert>
        )}

        <p className="text-xs text-muted">
          You can leave this page. Reading continues on the server, and the batch waits for you in
          Imports.
        </p>
      </CardBody>
    </Card>
  );
}
