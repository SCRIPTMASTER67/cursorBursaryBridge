import type { NextRequest } from 'next/server';
import { apiCorporate, apiError, apiOk } from '@/lib/auth/api';
import { getBatch } from '@/services/application-import';

/**
 * Batch progress, polled by the processing screen.
 *
 * The counters come from the batch row, which processBatch recomputes from the
 * files rather than incrementing, so what a reviewer watches is the real state
 * and not a client-side estimate.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const batch = await getBatch(id, auth.organisationId);
  if (!batch) return apiError('That import was not found.', 404);

  return apiOk({
    ok: true,
    status: batch.status,
    totalFiles: batch.totalFiles,
    processedFiles: batch.processedFiles,
    readyCount: batch.readyCount,
    reviewCount: batch.reviewCount,
    duplicateCount: batch.duplicateCount,
    failedCount: batch.failedCount,
    importedCount: batch.importedCount,
    failureReason: batch.failureReason,
  });
}
