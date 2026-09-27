import 'server-only';
import { waitUntil } from '@vercel/functions';

/**
 * Run work that outlives the response.
 *
 * Reading a pile of PDFs takes minutes, far longer than a browser or proxy
 * will hold a request open, so the handler returns as soon as the batch exists
 * and the review screen follows the counters. On a long-lived server that is
 * simply a floating promise: the process stays alive and finishes the job.
 *
 * On a serverless platform it is not. The instance is frozen the moment the
 * response is sent, so a floating promise stops mid-file and nothing says so —
 * the upload appears to succeed and the progress bar never moves again.
 * `waitUntil` keeps the invocation alive until the work settles, bounded by
 * the route's maxDuration.
 *
 * That bound is real: a batch larger than the limit is still cut short. It is
 * not lost, because each file's state is written as it is read, and the
 * progress screen notices the stall and resumes the unread remainder. The two
 * together mean a batch of any size finishes; this only decides whether that
 * takes one pass or several.
 *
 * Outside a Vercel request context — `next start`, a script, a test — there is
 * nothing to extend, and `waitUntil` throws rather than doing nothing. The
 * promise is already running by then, so the throw is caught and ignored.
 */
export function runDetached(work: Promise<unknown>, label: string): void {
  const guarded = work.then(
    () => undefined,
    (error: unknown) => {
      // eslint-disable-next-line no-console
      console.error(`[${label}] background work failed`, error);
    },
  );

  try {
    waitUntil(guarded);
  } catch {
    void guarded;
  }
}
