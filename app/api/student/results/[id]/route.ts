import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { ResultKind, SubjectLevel } from '@prisma/client';
import { apiError, apiOk, apiStudent, zodFields } from '@/lib/auth/api';
import { deleteResult, updateResult } from '@/services/student-results';

const updateSchema = z.object({
  subjectId: z.string().optional(),
  subjectName: z.string().trim().max(120).optional(),
  percentage: z.number().int().min(0).max(100).nullable().optional(),
  grade: z.string().trim().max(10).optional(),
  year: z.number().int().min(1990).max(2100),
  term: z.string().trim().max(40).optional(),
  kind: z.enum(['CURRENT', 'FINAL', 'PREDICTED', 'LATEST']).optional(),
  level: z.enum(['SCHOOL', 'TERTIARY']),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError('Check the result.', 422, zodFields(parsed.error));

  const result = await updateResult(auth.studentProfileId, id, {
    ...parsed.data,
    kind: parsed.data.kind as ResultKind | undefined,
    level: parsed.data.level as SubjectLevel,
  });
  if (!result.ok) return apiError(result.reason, 409, { subjectName: result.reason });
  return apiOk({ ok: true, result: result.value });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await deleteResult(auth.studentProfileId, id);
  if (!result.ok) return apiError(result.reason, 404);
  return apiOk({ ok: true });
}
