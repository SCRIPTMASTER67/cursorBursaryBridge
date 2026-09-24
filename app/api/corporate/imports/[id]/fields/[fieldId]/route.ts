import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiCorporate, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { audit } from '@/services/audit';

const schema = z.object({
  value: z.string().trim().max(4000),
});

/**
 * Correct a field a reviewer disagrees with.
 *
 * The extracted value is never overwritten. The correction is stored beside it,
 * with who made it and when, so the record shows both what the form said and
 * what a person decided it meant -- which is the only way a wrong import can
 * later be told apart from a wrong form.
 *
 * Corrections are refused once the file has been imported: at that point the
 * applicant record is the thing to edit, and changing the extraction behind it
 * would leave the two disagreeing.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id, fieldId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = zodFields(parsed.error);
    return apiError(fields.value ?? 'Invalid request.', 422, fields);
  }

  const field = await prisma.importExtractedField.findFirst({
    where: {
      id: fieldId,
      file: { batchId: id, batch: { organisationId: auth.organisationId } },
    },
    select: { id: true, canonicalKey: true, value: true, file: { select: { status: true } } },
  });
  if (!field) return apiError('That field was not found.', 404);

  if (field.file.status === 'IMPORTED') {
    return apiError('This application has been imported; edit the applicant instead.', 409);
  }

  const value = parsed.data.value;
  const updated = await prisma.importExtractedField.update({
    where: { id: fieldId },
    data: {
      // Clearing the box removes the correction and restores what was read,
      // rather than storing an empty correction that hides the original.
      correctedValue: value === '' ? null : value,
      correctedById: value === '' ? null : auth.user.id,
      correctedAt: value === '' ? null : new Date(),
    },
    select: { id: true, value: true, correctedValue: true },
  });

  await audit({
    userId: auth.user.id,
    action: 'import.field.corrected',
    entityType: 'ImportExtractedField',
    entityId: fieldId,
    metadata: { key: field.canonicalKey, from: field.value, to: value || null },
  });

  return apiOk({ ok: true, field: updated });
}
