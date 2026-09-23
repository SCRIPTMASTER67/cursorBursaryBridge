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

export type DisplayStatus =
  | 'OPEN'
  | 'CLOSING_SOON'
  | 'UPCOMING'
  | 'CLOSED'
  | 'NEEDS_VERIFICATION'
  | 'UNKNOWN';

/**
 * How near a deadline has to be before it is called out.
 *
 * Two weeks: long enough to gather documents and write a motivation, short
 * enough that saying "closing soon" still means something.
 */
export const CLOSING_SOON_DAYS = 14;

export type StatusInput = {
  availability: Availability;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: Date | null;
  origin: OpportunityOrigin;
  /** Null for a rolling opportunity, or one whose source states no date. */
  closingDate?: Date | null;
};

export function displayStatus(input: StatusInput, now = new Date()): DisplayStatus {
  // Closed is closed. It never needs re-confirming to be shown as closed, and
  // showing it as anything else would be worse.
  if (input.availability === 'CLOSED') return 'CLOSED';
  if (input.availability === 'UPCOMING') return 'UPCOMING';
  if (input.availability === 'UNKNOWN') return 'UNKNOWN';

  // A funder maintaining their own programme here is the source, so there is
  // nothing external to re-check.
  if (input.origin === 'FIRST_PARTY') return openOrClosingSoon(input.closingDate ?? null, now);

  if (input.verificationStatus === 'SOURCE_GONE') return 'UNKNOWN';
  if (input.verificationStatus !== 'VERIFIED') return 'NEEDS_VERIFICATION';
  if (!input.lastVerifiedAt) return 'NEEDS_VERIFICATION';

  const ageDays = (now.getTime() - input.lastVerifiedAt.getTime()) / 86_400_000;
  return ageDays <= FRESHNESS_DAYS
    ? openOrClosingSoon(input.closingDate ?? null, now)
    : 'NEEDS_VERIFICATION';
}

/**
 * Open, or open and about to close.
 *
 * Only a real date can make something "closing soon". A rolling opportunity,
 * or one whose source states no deadline, stays simply open — inventing
 * urgency would be as dishonest as inventing the date it came from.
 */
function openOrClosingSoon(closingDate: Date | null, now: Date): DisplayStatus {
  if (!closingDate) return 'OPEN';
  const days = (closingDate.getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return 'CLOSED';
  return days <= CLOSING_SOON_DAYS ? 'CLOSING_SOON' : 'OPEN';
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
  CLOSING_SOON: {
    label: 'Closing soon',
    meaning: 'Applications are open, but the deadline is close. Apply now.',
    tone: 'warning',
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
  // Closing soon leads, because it is the one a student can lose by waiting.
  'CLOSING_SOON',
  'OPEN',
  'UPCOMING',
  'NEEDS_VERIFICATION',
  'UNKNOWN',
  'CLOSED',
];

/** Whether a student may apply through Bursary-Bridge. Only ever true for OPEN. */
export function canApplyHere(status: DisplayStatus, origin: OpportunityOrigin): boolean {
  return (status === 'OPEN' || status === 'CLOSING_SOON') && origin === 'FIRST_PARTY';
}

/** Whether a student can still act on this, for anything that gates on "open". */
export function isOpenNow(status: DisplayStatus): boolean {
  return status === 'OPEN' || status === 'CLOSING_SOON';
}
