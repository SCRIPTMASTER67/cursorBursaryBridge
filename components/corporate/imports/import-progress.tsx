'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Card, CardBody } from '@/components/ui';
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
export function ImportProgress({ batchId, initial }: { batchId: string; initial: Status }) {
  const router = useRouter();
  const [state, setState] = useState(initial);

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

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [batchId, state.status, router]);

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

        <p className="text-xs text-muted">
          You can leave this page. Reading continues on the server, and the batch waits for you in
          Imports.
        </p>
      </CardBody>
    </Card>
  );
}
