import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiCorporate, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { audit } from '@/services/audit';
import { confirmImport } from '@/services/application-import';

const schema = z.object({
  decisions: z
    .array(
      z.object({
        fileId: z.string().cuid(),
        action: z.enum(['IMPORT', 'DISCARD']),
      }),
    )
    .max(2000),
});

/**
 * Turn a reviewed batch into applications.
 *
 * Nothing in a batch becomes an applicant record until this runs, which is the
 * point of the review step: extraction is a proposal, and this is the decision.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = zodFields(parsed.error);
    return apiError(fields.decisions ?? 'Invalid request.', 422, fields);
  }

  const result = await confirmImport(id, auth.organisationId, auth.user.id, parsed.data.decisions);
  if (!result.ok) return apiError(result.reason, 404);

  await audit({
    userId: auth.user.id,
    action: 'import.confirmed',
    entityType: 'ApplicationImportBatch',
    entityId: id,
    metadata: { imported: result.imported, discarded: result.discarded },
  });

  return apiOk(result);
}
