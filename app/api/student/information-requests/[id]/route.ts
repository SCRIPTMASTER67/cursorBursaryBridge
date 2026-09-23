import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, apiStudent, zodFields } from '@/lib/auth/api';
import {
  attachDocument,
  detachDocument,
  requestForStudent,
  submitResponse,
} from '@/services/information-requests';

/**
 * A student answering a funder's request.
 *
 * Every operation is scoped to the student who received the request: another
 * student's id is indistinguishable from one that does not exist.
 */
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ATTACH'), itemId: z.string(), documentId: z.string() }),
  z.object({ action: z.literal('DETACH'), itemId: z.string() }),
  z.object({ action: z.literal('SUBMIT') }),
]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const found = await requestForStudent(id, auth.studentProfileId);
  if (!found) return apiError('That request was not found.', 404);
  return apiOk({ request: found });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid action.', 422, zodFields(parsed.error));

  if (parsed.data.action === 'ATTACH') {
    const result = await attachDocument({
      studentProfileId: auth.studentProfileId,
      itemId: parsed.data.itemId,
      documentId: parsed.data.documentId,
    });
    if (!result.ok) return apiError(result.reason, 404);
    return apiOk({ ok: true });
  }

  if (parsed.data.action === 'DETACH') {
    const result = await detachDocument(auth.studentProfileId, parsed.data.itemId);
    if (!result.ok) return apiError(result.reason, 404);
    return apiOk({ ok: true });
  }

  const result = await submitResponse(auth.studentProfileId, id, auth.user.id);
  if (!result.ok) return apiError(result.reason, 409);
  return apiOk({ ok: true, ...result.value });
}
