import { apiError, apiOk, apiStudent } from '@/lib/auth/api';
import { getJob } from '@/services/auto-fill';

/**
 * A job's current state, including per-form progress.
 *
 * The client polls this while processing runs, so the progress it shows is the
 * real number of forms finished rather than an animation.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const job = await getJob(id, auth.studentProfileId);
  if (!job) return apiError('That job was not found.', 404);

  const done = job.targetForms.filter((f) => f.status === 'COMPLETED' || f.status === 'FAILED');
  return apiOk({
    job,
    progress: { done: done.length, total: job.targetForms.length },
  });
}
