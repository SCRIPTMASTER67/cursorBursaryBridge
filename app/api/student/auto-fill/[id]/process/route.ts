import { apiError, apiOk, apiStudent } from '@/lib/auth/api';
import { rateLimit } from '@/lib/auth/rate-limit';
import { processJob } from '@/services/auto-fill';

/** Run the engine over a job. Safe to call again: a re-run replaces the last result. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`autofill:process:${auth.user.id}`, 10, 600);
  if (!limit.allowed) {
    return apiError('Too many runs. Please wait a few minutes and try again.', 429);
  }

  const { id } = await params;
  const result = await processJob({
    jobId: id,
    studentProfileId: auth.studentProfileId,
    userId: auth.user.id,
  });

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') return apiError('That job was not found.', 404);
    if (result.reason === 'BUSY') return apiError('This job is already being processed.', 409);
    if (result.reason === 'NO_TARGETS') {
      return apiError('Add at least one form to fill in before processing.', 422);
    }
    return apiError('Your completed form is no longer available. Please upload it again.', 410);
  }

  return apiOk(result);
}
