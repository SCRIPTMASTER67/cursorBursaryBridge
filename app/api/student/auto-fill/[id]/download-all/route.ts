import { NextResponse } from 'next/server';
import { apiError, apiStudent } from '@/lib/auth/api';
import { renderJobArchive } from '@/services/auto-fill';

/** Every filled form from one job, as a ZIP of real PDFs. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await renderJobArchive(id, auth.studentProfileId);

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') return apiError('That job was not found.', 404);
    return apiError('There are no filled forms to download yet.', 409);
  }

  return new NextResponse(new Uint8Array(result.bytes), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
