import type { Availability, OpportunityOrigin, VerificationStatus } from '@prisma/client';
import { FRESHNESS_DAYS } from '@/lib/ingest/validate';

/**
 * What the directory is allowed to claim about an opportunity.
 *
 * `availability` is the best understanding of the application window.
 * `DisplayStatus` is what a student is actually shown, and it is deliberately
 * more cautious: an opportunity believed to be open but not confirmed lately
 * is shown as needing verification, never as open. Sending somebody to a
 * bursary that closed last week is the failure this guards against.
 */

export type DisplayStatus = 'OPEN' | 'UPCOMING' | 'CLOSED' | 'NEEDS_VERIFICATION' | 'UNKNOWN';

export type StatusInput = {
  availability: Availability;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: Date | null;
  origin: OpportunityOrigin;
};

export function displayStatus(input: StatusInput, now = new Date()): DisplayStatus {
  // Closed is closed. It never needs re-confirming to be shown as closed, and
  // showing it as anything else would be worse.
  if (input.availability === 'CLOSED') return 'CLOSED';
  if (input.availability === 'UPCOMING') return 'UPCOMING';
  if (input.availability === 'UNKNOWN') return 'UNKNOWN';

  // A funder maintaining their own programme here is the source, so there is
  // nothing external to re-check.
  if (input.origin === 'FIRST_PARTY') return 'OPEN';

  if (input.verificationStatus === 'SOURCE_GONE') return 'UNKNOWN';
  if (input.verificationStatus !== 'VERIFIED') return 'NEEDS_VERIFICATION';
  if (!input.lastVerifiedAt) return 'NEEDS_VERIFICATION';

  const ageDays = (now.getTime() - input.lastVerifiedAt.getTime()) / 86_400_000;
  return ageDays <= FRESHNESS_DAYS ? 'OPEN' : 'NEEDS_VERIFICATION';
}

/** How each status reads to a student, and what it means for them. */
export const STATUS_COPY: Record<
  DisplayStatus,
  { label: string; meaning: string; tone: 'success' | 'info' | 'warning' | 'neutral' }
> = {
  OPEN: {
    label: 'Open',
    meaning: 'Applications are open.',
    tone: 'success',
  },
  UPCOMING: {
    label: 'Opening soon',
    meaning: 'Announced, but applications have not opened yet.',
    tone: 'info',
  },
  CLOSED: {
    label: 'Closed',
    meaning: 'Applications are closed for this cycle.',
    tone: 'neutral',
  },
  NEEDS_VERIFICATION: {
    label: 'Needs checking',
    meaning:
      'We have not been able to confirm this with the source recently, so we cannot say it is open. Check the source before you rely on it.',
    tone: 'warning',
  },
  UNKNOWN: {
    label: 'Status unknown',
    meaning: 'The source does not say whether applications are open.',
    tone: 'neutral',
  },
};

/**
 * The order the directory lists statuses in.
 *
 * Open first, because that is what a student can act on today. Closed stays in
 * the list — it tells them who funds what, and when to come back — but it goes
 * last.
 */
export const STATUS_ORDER: DisplayStatus[] = [
  'OPEN',
  'UPCOMING',
  'NEEDS_VERIFICATION',
  'UNKNOWN',
  'CLOSED',
];

/** Whether a student may apply through Bursary-Bridge. Only ever true for OPEN. */
export function canApplyHere(status: DisplayStatus, origin: OpportunityOrigin): boolean {
  return status === 'OPEN' && origin === 'FIRST_PARTY';
}
