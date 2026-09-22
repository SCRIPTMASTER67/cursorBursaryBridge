import { NextResponse } from 'next/server';
import { apiError, apiStudent } from '@/lib/auth/api';
import { renderFilledForm } from '@/services/auto-fill';

/**
 * Download one filled form as a real PDF.
 *
 * The file is built here and now from the original upload and the values as
 * they currently stand, so what the student downloads is always what the
 * review screen showed them.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ formId: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { formId } = await params;
  const result = await renderFilledForm(formId, auth.studentProfileId);

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') return apiError('That form was not found.', 404);
    if (result.reason === 'NOT_READY')
      return apiError('This form has not been filled in yet.', 409);
    return apiError('That upload is no longer available.', 410);
  }

  return new NextResponse(new Uint8Array(result.bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
