import type { NextRequest } from 'next/server';
import { apiError, apiOk, apiStudent } from '@/lib/auth/api';
import { rateLimit } from '@/lib/auth/rate-limit';
import { readPdfUpload } from '@/lib/pdf/upload';
import { createJob, listJobs } from '@/services/auto-fill';

/** The student's own auto-fill jobs, newest first. */
export async function GET() {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;
  return apiOk({ jobs: await listJobs(auth.studentProfileId) });
}

/** Start a job by uploading the completed form it will read from. */
export async function POST(request: NextRequest) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`autofill:create:${auth.user.id}`, 10, 600);
  if (!limit.allowed) {
    return apiError('Too many uploads. Please wait a few minutes and try again.', 429);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return apiError('Invalid upload.');

  const check = await readPdfUpload(formData.get('source'), 'completed bursary form');
  if (!check.ok) return apiError(check.message, 422, { source: check.message });

  const job = await createJob({
    studentProfileId: auth.studentProfileId,
    userId: auth.user.id,
    fileName: check.fileName,
    bytes: check.bytes,
  });

  return apiOk({ ok: true, job }, 201);
}
