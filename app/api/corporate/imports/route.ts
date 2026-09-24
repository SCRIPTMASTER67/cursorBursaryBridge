import type { NextRequest } from 'next/server';
import { apiCorporate, apiError, apiOk } from '@/lib/auth/api';
import { audit } from '@/services/audit';
import { createBatch, processBatch } from '@/services/application-import';
import { MAX_ENTRIES, MAX_TOTAL_BYTES } from '@/lib/import/bundle';

/**
 * Start an import.
 *
 * The request is multipart because the browser is sending files, and the files
 * are read into memory here only long enough to hand them to createBatch,
 * which writes each one to storage before anything is parsed. Extraction then
 * runs detached: seven hundred PDFs take minutes, which is far longer than any
 * browser or proxy will hold a request open, so the handler returns as soon as
 * the batch exists and the review screen follows its progress.
 */
export async function POST(request: NextRequest) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError('That upload could not be read. Please try again.', 400);
  }

  const fundingProgrammeId = String(form.get('fundingProgrammeId') ?? '');
  if (!fundingProgrammeId) {
    return apiError('Choose the programme these applications are for.', 422, {
      fundingProgrammeId: 'Choose a programme.',
    });
  }

  const entries = form.getAll('files').filter((value): value is File => value instanceof File);
  if (entries.length === 0) {
    return apiError('Add at least one PDF or ZIP file.', 422, { files: 'Add at least one file.' });
  }
  if (entries.length > MAX_ENTRIES) {
    return apiError(`No more than ${MAX_ENTRIES} files in one upload.`, 422);
  }

  const total = entries.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    return apiError('That upload is larger than the 1 GB limit. Split it and try again.', 422);
  }

  const uploads = [];
  for (const file of entries) {
    uploads.push({
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  }

  const created = await createBatch({
    organisationId: auth.organisationId,
    fundingProgrammeId,
    userId: auth.user.id,
    uploads,
  });
  if (!created.ok) return apiError(created.reason, 422);

  await audit({
    userId: auth.user.id,
    action: 'import.created',
    entityType: 'ApplicationImportBatch',
    entityId: created.batchId,
    metadata: { files: uploads.length, reference: created.reference },
  });

  // Detached on purpose. A failure inside is recorded on the batch, which is
  // what the review screen reads, so it is never lost by being unobserved.
  void processBatch(created.batchId).catch((error) => {
    console.error('[import] processing failed', created.batchId, error);
  });

  return apiOk({ ok: true, batchId: created.batchId, reference: created.reference });
}
