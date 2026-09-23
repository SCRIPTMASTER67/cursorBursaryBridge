import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, apiStudent, zodFields } from '@/lib/auth/api';
import { deleteLetter, regenerateLetter, saveLetter } from '@/services/motivational-letters';

const saveSchema = z.object({
  action: z.literal('SAVE'),
  content: z.string().max(20_000).optional(),
  title: z.string().trim().max(200).optional(),
  status: z.enum(['DRAFT', 'READY']).optional(),
});

const regenerateSchema = z.object({
  action: z.literal('REGENERATE'),
  answers: z
    .object({
      whyApplying: z.string().trim().max(2000).optional(),
      goals: z.string().trim().max(2000).optional(),
      whyThisField: z.string().trim().max(2000).optional(),
      fundingChallenges: z.string().trim().max(2000).optional(),
      proudestAchievement: z.string().trim().max(2000).optional(),
      whySuitable: z.string().trim().max(2000).optional(),
      howItHelps: z.string().trim().max(2000).optional(),
    })
    .default({}),
});

const bodySchema = z.discriminatedUnion('action', [saveSchema, regenerateSchema]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError('Check the letter.', 422, zodFields(parsed.error));

  if (parsed.data.action === 'REGENERATE') {
    const result = await regenerateLetter(
      id,
      auth.studentProfileId,
      auth.user.id,
      parsed.data.answers,
    );
    if (!result.ok) return apiError(result.reason, 404);
    return apiOk({ ok: true, letter: result.letter, gaps: result.gaps });
  }

  const result = await saveLetter(id, auth.studentProfileId, parsed.data);
  if (!result.ok) return apiError(result.reason, 422, { content: result.reason });
  return apiOk({ ok: true, letter: result.letter });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await deleteLetter(id, auth.studentProfileId);
  if (!result.ok) return apiError(result.reason, 404);
  return apiOk({ ok: true });
}
