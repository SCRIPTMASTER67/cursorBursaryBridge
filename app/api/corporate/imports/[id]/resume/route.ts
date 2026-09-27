import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiCorporate, apiError, apiOk } from '@/lib/auth/api';
import { runDetached } from '@/lib/background';
import { audit } from '@/services/audit';
import { getBatch, processBatch } from '@/services/application-import';

/**
 * Pick a batch back up.
 *
 * Extraction runs in the application process, so a deploy or a restart part way
 * through a large batch leaves files PENDING and the batch stuck on EXTRACTING.
 * processBatch is written to be safe to call again -- it takes whatever is
 * still PENDING and recomputes the counters from the files rather than
 * incrementing them -- so resuming is the whole remedy, and this is the button
 * for it.
 */
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const batch = await getBatch(id, auth.organisationId);
  if (!batch) return apiError('That import was not found.', 404);

  if (batch.status === 'COMPLETED' || batch.status === 'IMPORTING') {
    return apiError('That import has already been completed.', 409);
  }

  const pending = await prisma.applicationImportFile.count({
    where: { batchId: id, status: { in: ['PENDING', 'PROCESSING'] } },
  });
  if (pending === 0) {
    return apiError('Every file in this import has already been read.', 409);
  }

  // A file interrupted mid-read is left PROCESSING, and processBatch only
  // picks up PENDING -- so without this the batch resumes, skips the very file
  // it died on, and never completes while resume keeps reporting success.
  // Putting them back to PENDING is safe: reading a file writes only that
  // file's own row from the stored bytes, so doing it twice lands on the same
  // result. And this runs only when the batch is genuinely stuck, either after
  // two minutes without a single file being read or because someone asked.
  const restarted = await prisma.applicationImportFile.updateMany({
    where: { batchId: id, status: 'PROCESSING' },
    data: { status: 'PENDING' },
  });

  await prisma.applicationImportBatch.update({
    where: { id },
    data: { status: 'EXTRACTING', failureReason: null },
  });

  await audit({
    userId: auth.user.id,
    action: 'import.resumed',
    entityType: 'ApplicationImportBatch',
    entityId: id,
    metadata: { pending, restarted: restarted.count },
  });

  runDetached(processBatch(id), `import resume ${id}`);

  return apiOk({ ok: true, pending });
}
