'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Refresh } from '@/components/icons';

/**
 * Run a source now.
 *
 * Reports what the run actually did, including a run that reached nothing —
 * which is the case an administrator most needs to be able to tell apart from
 * a run that found nothing.
 */
export function SyncButton({
  sourceId,
  label = 'Sync now',
  size = 'sm',
}: {
  sourceId?: string;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/ingestion/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        totals?: {
          opportunitiesCreated: number;
          opportunitiesUpdated: number;
          sourcesBlocked: number;
        };
        notes?: string[];
      };

      if (!response.ok) {
        toast.push('error', payload.error ?? 'The sync could not be started.');
        return;
      }

      if (payload.status === 'BLOCKED') {
        toast.push(
          'info',
          payload.notes?.[0] ??
            'No source could be read. Nothing was collected and nothing was confirmed.',
        );
      } else if (payload.status === 'FAILED') {
        toast.push('error', payload.notes?.[0] ?? 'The sync finished with errors.');
      } else {
        const created = payload.totals?.opportunitiesCreated ?? 0;
        const updated = payload.totals?.opportunitiesUpdated ?? 0;
        toast.push('success', `Sync finished: ${created} new, ${updated} updated.`);
      }
      router.refresh();
    } catch {
      toast.push('error', 'Could not reach Bursary-Bridge.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size={size}
      variant="outline"
      loading={busy}
      onClick={sync}
      leadingIcon={<Refresh className="h-4 w-4" />}
    >
      {label}
    </Button>
  );
}
