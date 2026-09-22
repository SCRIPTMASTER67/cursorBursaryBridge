import type { NextRequest } from 'next/server';
import { apiError, apiOk, apiStudent } from '@/lib/auth/api';
import { editField } from '@/services/auto-fill';

/**
 * Change one field's value.
 *
 * The student has the last word on every field: what they type is written as
 * written. Sending null or an empty string clears the field, which is a valid
 * thing to want.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> },
) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { value?: unknown } | null;
  if (!body || !('value' in body)) return apiError('Send the new value.', 422);

  const raw = body.value;
  if (raw !== null && typeof raw !== 'string') {
    return apiError('A field value must be text.', 422);
  }
  if (typeof raw === 'string' && raw.length > 5000) {
    return apiError('That answer is too long for a form field.', 422, {
      value: 'Use 5000 characters or fewer',
    });
  }

  const { fieldId } = await params;
  const result = await editField({
    fieldId,
    studentProfileId: auth.studentProfileId,
    userId: auth.user.id,
    value: raw ?? null,
  });

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') return apiError('That field was not found.', 404);
    return apiError('This form only accepts one of its own options for this field.', 422, {
      value: `Choose one of: ${result.options.join(', ')}`,
    });
  }

  return apiOk({ ok: true, field: result.field });
}
