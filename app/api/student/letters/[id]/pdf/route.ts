import { apiError, apiStudent } from '@/lib/auth/api';
import { letterFileName, letterToPdf } from '@/lib/letters/pdf';
import { letterFor } from '@/services/motivational-letters';

/**
 * Download a letter as a PDF.
 *
 * Scoped to the signed-in student's own letters, like every other read: the
 * id alone is not authority to fetch one.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const letter = await letterFor(id, auth.studentProfileId);
  if (!letter) return apiError('That letter was not found.', 404);

  const bytes = await letterToPdf(letter.content);
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${letterFileName(letter.title)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
