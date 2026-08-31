'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProgrammeStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

/** Publish, unpublish or close a programme from its detail page. */
export function ProgrammeActions({
  programmeId,
  status,
}: {
  programmeId: string;
  status: ProgrammeStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<ProgrammeStatus | null>(null);

  async function setStatus(next: ProgrammeStatus) {
    setBusy(true);
    try {
      const response = await fetch(`/api/corporate/programmes/${programmeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        toast.push('error', payload.error ?? 'That change could not be saved.');
        return;
      }

      const messages: Record<ProgrammeStatus, string> = {
        PUBLISHED: 'Programme published. Matching students can see it now.',
        DRAFT: 'Programme unpublished. It is no longer visible to students.',
        CLOSED: 'Programme closed. It no longer accepts applications.',
      };
      toast.push('success', messages[next]);
      setConfirming(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {status === 'DRAFT' && (
        <Button onClick={() => setStatus('PUBLISHED')} loading={busy}>
          Publish Programme
        </Button>
      )}
      {status === 'PUBLISHED' && (
        <Button variant="outline" onClick={() => setConfirming('CLOSED')} disabled={busy}>
          Close Programme
        </Button>
      )}
      {status === 'CLOSED' && (
        <Button variant="outline" onClick={() => setStatus('PUBLISHED')} loading={busy}>
          Reopen Programme
        </Button>
      )}

      <ConfirmDialog
        open={confirming === 'CLOSED'}
        onClose={() => setConfirming(null)}
        onConfirm={() => setStatus('CLOSED')}
        loading={busy}
        title="Close this programme?"
        message="Students will no longer see it or be able to apply. Applications already received are unaffected, and you can reopen it later."
        confirmLabel="Close programme"
      />
    </>
  );
}
