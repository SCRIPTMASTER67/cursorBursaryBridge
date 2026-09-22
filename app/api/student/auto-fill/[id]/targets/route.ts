import type { NextRequest } from 'next/server';
import { apiError, apiOk, apiStudent } from '@/lib/auth/api';
import { rateLimit } from '@/lib/auth/rate-limit';
import { readPdfUpload } from '@/lib/pdf/upload';
import { MAX_TARGET_FORMS, addTargetForms } from '@/services/auto-fill';

/**
 * Add blank forms to a job.
 *
 * Each file is checked on its own. One bad file is reported by name and the
 * good ones are still accepted, so a student does not have to start again.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`autofill:targets:${auth.user.id}`, 20, 600);
  if (!limit.allowed) {
    return apiError('Too many uploads. Please wait a few minutes and try again.', 429);
  }

  const { id } = await params;
  const formData = await request.formData().catch(() => null);
  if (!formData) return apiError('Invalid upload.');

  const files = formData.getAll('forms');
  if (files.length === 0) return apiError('Please choose at least one form to fill in.', 422);

  const accepted: { fileName: string; bytes: Buffer }[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const check = await readPdfUpload(file, 'bursary form');
    if (check.ok) accepted.push({ fileName: check.fileName, bytes: check.bytes });
    else rejected.push(check.message);
  }

  if (accepted.length === 0) {
    return apiError(rejected[0] ?? 'None of those files could be accepted.', 422);
  }

  const result = await addTargetForms({
    jobId: id,
    studentProfileId: auth.studentProfileId,
    files: accepted,
  });

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') return apiError('That job was not found.', 404);
    if (result.reason === 'BUSY') return apiError('This job is still being processed.', 409);
    return apiError(`You can add up to ${MAX_TARGET_FORMS} forms to one job.`, 422);
  }

  return apiOk({ ok: true, targetForms: result.targetForms, rejected }, 201);
}
