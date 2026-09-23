import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { ResultKind, SubjectLevel } from '@prisma/client';
import { apiError, apiOk, apiStudent, zodFields } from '@/lib/auth/api';
import { addResult, listResults, reorderResults } from '@/services/student-results';

/**
 * A student's subject and module results.
 *
 * These feed the matching engine, so a bursary asking for Mathematics at 70%
 * can be checked against the mark the student actually has.
 */
const resultSchema = z.object({
  subjectId: z.string().optional(),
  subjectName: z.string().trim().max(120).optional(),
  // Null is a real answer: the student knows the subject but not yet the mark.
  percentage: z.number().int().min(0).max(100).nullable().optional(),
  grade: z.string().trim().max(10).optional(),
  year: z.number().int().min(1990).max(2100),
  term: z.string().trim().max(40).optional(),
  kind: z.enum(['CURRENT', 'FINAL', 'PREDICTED', 'LATEST']).optional(),
  level: z.enum(['SCHOOL', 'TERTIARY']),
});

const reorderSchema = z.object({ order: z.array(z.string()).max(100) });

export async function GET() {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;
  return apiOk({ results: await listResults(auth.studentProfileId) });
}

export async function POST(request: NextRequest) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) return apiError('Check the result.', 422, zodFields(parsed.error));

  if (!parsed.data.subjectId && !parsed.data.subjectName) {
    return apiError('Choose a subject or type its name.', 422, {
      subjectName: 'Choose a subject or type its name',
    });
  }

  const result = await addResult(auth.studentProfileId, {
    ...parsed.data,
    kind: parsed.data.kind as ResultKind | undefined,
    level: parsed.data.level as SubjectLevel,
  });
  if (!result.ok) return apiError(result.reason, 409, { subjectName: result.reason });

  return apiOk({ ok: true, result: result.value }, 201);
}

/** Save the student's own ordering. */
export async function PATCH(request: NextRequest) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid ordering.', 422, zodFields(parsed.error));

  const result = await reorderResults(auth.studentProfileId, parsed.data.order);
  if (!result.ok) return apiError(result.reason, 422);
  return apiOk({ ok: true });
}
