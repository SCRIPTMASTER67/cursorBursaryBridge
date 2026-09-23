import type { Availability, ProgrammeStatus } from '@prisma/client';

/**
 * Whether a programme published here is open.
 *
 * For a first-party programme the funder is the source: they set the window in
 * this application, so the window is authoritative and no external check is
 * needed. That is the opposite of an ingested opportunity, where dates can
 * only ever prove something is NOT open because the funder may have closed it
 * early somewhere we cannot see.
 */
export function firstPartyAvailability(input: {
  status: ProgrammeStatus;
  openDate: Date | null;
  closingDate: Date | null;
  now?: Date;
}): Availability {
  const now = input.now ?? new Date();

  // Anything not published cannot be applied for, whatever its dates say.
  if (input.status !== 'PUBLISHED') return 'CLOSED';

  if (input.closingDate && input.closingDate < now) return 'CLOSED';
  if (input.openDate && input.openDate > now) return 'UPCOMING';

  // Published, not yet closed, and either already open or with no stated start.
  return 'OPEN';
}
