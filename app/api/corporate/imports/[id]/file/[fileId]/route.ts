import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiCorporate, apiError } from '@/lib/auth/api';
import { storage } from '@/lib/storage';

/**
 * The original uploaded application form.
 *
 * The file the organisation sent is never replaced by what was extracted from
 * it, so a reviewer checking a value against the source is looking at the
 * document itself. The batch's organisationId is in the WHERE clause, so one
 * organisation cannot read another's uploads.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id, fileId } = await params;
  const file = await prisma.applicationImportFile.findFirst({
    where: { id: fileId, batchId: id, batch: { organisationId: auth.organisationId } },
    select: { fileName: true, storageKey: true, contentType: true },
  });
  if (!file) return apiError('That file was not found.', 404);

  const object = await storage().get(file.storageKey);
  if (!object) return apiError('That file is no longer available.', 404);

  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      'Content-Type': file.contentType || object.contentType,
      'Content-Disposition': `inline; filename="${file.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
