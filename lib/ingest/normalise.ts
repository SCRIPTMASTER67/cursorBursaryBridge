import type { Availability, DeadlineKind, FundingType } from '@prisma/client';

/**
 * Turning what a page says into what the database stores.
 *
 * Every function here returns "I could not tell" as a first-class answer. A
 * date it cannot read becomes UNKNOWN, not today's date plus a guess; a status
 * it cannot read becomes UNKNOWN, not OPEN. That is the difference between a
 * directory a student can trust and one that sends them to a closed bursary.
 */

export type DeadlineReading = {
  kind: DeadlineKind;
  date: Date | null;
  /** The source's own wording, kept whenever it says more than a date does. */
  note: string | null;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const ROLLING =
  /\b(rolling|throughout the year|all year|no closing date|no deadline|ongoing|continuous)\b/i;
const UNTIL_FILLED =
  /\b(until (all )?(places|positions|posts|spaces) are filled|until filled|while (places|positions) last)\b/i;

/**
 * Read a deadline.
 *
 * South African bursary pages write dates day-first, so 03/04/2027 is 3 April.
 * A page that names a month removes the ambiguity, which is why a named month
 * is tried before a numeric one.
 */
export function readDeadline(text: string | undefined | null): DeadlineReading {
  const value = (text ?? '').trim();
  if (!value) return { kind: 'UNKNOWN', date: null, note: null };

  if (UNTIL_FILLED.test(value)) return { kind: 'UNTIL_FILLED', date: null, note: value };
  if (ROLLING.test(value)) return { kind: 'ROLLING', date: null, note: value };

  const named = /(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\s+(\d{4})/.exec(value);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month) {
      const date = endOfDay(Number(named[3]), month, Number(named[1]));
      if (date) return { kind: 'FIXED', date, note: value };
    }
  }

  const monthFirst = /([A-Za-z]{3,})\s+(\d{1,2})\s*(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(value);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].slice(0, 3).toLowerCase()];
    if (month) {
      const date = endOfDay(Number(monthFirst[3]), month, Number(monthFirst[2]));
      if (date) return { kind: 'FIXED', date, note: value };
    }
  }

  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (iso) {
    const date = endOfDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (date) return { kind: 'FIXED', date, note: value };
  }

  const numeric = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(value);
  if (numeric) {
    const date = endOfDay(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
    if (date) return { kind: 'FIXED', date, note: value };
  }

  // Something was said about a deadline, but it is not a date we can act on.
  // It is kept verbatim so the student reads the source's own words.
  return { kind: 'UNKNOWN', date: null, note: value };
}

/**
 * A closing date is the last day applications are accepted, so it runs to the
 * end of that day in South African time rather than to midnight at its start.
 */
function endOfDay(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  // SAST is UTC+2 year round, so the end of the day locally is 21:59:59Z.
  const date = new Date(Date.UTC(year, month - 1, day, 21, 59, 59));
  if (date.getUTCDate() !== day && !(day > 28)) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1) return null;
  return date;
}

const CLOSED_WORDS =
  /\b(closed|now closed|applications (are )?closed|deadline (has )?passed|no longer accepting)\b/i;
const OPEN_WORDS = /\b(open|now open|applications (are )?open|currently accepting|apply now)\b/i;
const UPCOMING_WORDS = /\b(opens on|opening soon|applications open|not yet open|coming soon)\b/i;

/**
 * Decide whether applications are open.
 *
 * What the source says comes first: an organisation that writes "applications
 * are closed" has closed them, whatever its published deadline says. Dates are
 * only consulted when the page states no status, and when neither is available
 * the answer is UNKNOWN rather than a guess in either direction.
 */
export function readAvailability(input: {
  statusText?: string | null;
  openDate: Date | null;
  closingDate: Date | null;
  deadlineKind: DeadlineKind;
  now?: Date;
}): { availability: Availability; because: string } {
  const now = input.now ?? new Date();
  const said = (input.statusText ?? '').trim();

  if (said) {
    if (CLOSED_WORDS.test(said)) {
      return { availability: 'CLOSED', because: `The source states: "${trim(said)}".` };
    }
    if (UPCOMING_WORDS.test(said) && input.openDate && input.openDate > now) {
      return { availability: 'UPCOMING', because: `The source states: "${trim(said)}".` };
    }
    if (OPEN_WORDS.test(said)) {
      // An explicit "open" is still not trusted past a closing date that has
      // already gone: stale pages are the common case, not the exception.
      if (input.closingDate && input.closingDate < now) {
        return {
          availability: 'UNKNOWN',
          because: 'The source says applications are open but its own closing date has passed.',
        };
      }
      return { availability: 'OPEN', because: `The source states: "${trim(said)}".` };
    }
  }

  if (input.deadlineKind === 'ROLLING' || input.deadlineKind === 'UNTIL_FILLED') {
    return {
      availability: 'OPEN',
      because: 'The source states applications are accepted on an ongoing basis.',
    };
  }

  if (input.openDate && input.openDate > now) {
    return { availability: 'UPCOMING', because: 'Applications have not opened yet.' };
  }
  if (input.closingDate && input.closingDate < now) {
    return { availability: 'CLOSED', because: 'The closing date has passed.' };
  }
  if (input.closingDate) {
    return { availability: 'OPEN', because: 'The closing date has not passed.' };
  }

  return {
    availability: 'UNKNOWN',
    because: 'The source does not state whether applications are open.',
  };
}

function trim(value: string): string {
  return value.length <= 120 ? value : `${value.slice(0, 117)}…`;
}

export function readFundingType(text: string | undefined | null): FundingType {
  const value = (text ?? '').toLowerCase();
  if (/scholarship/.test(value)) return 'SCHOLARSHIP';
  if (/\bgrant\b/.test(value)) return 'GRANT';
  if (/bursar/.test(value)) return 'BURSARY';
  return 'OTHER';
}

/** Collapse whitespace and strip the boilerplate that surrounds scraped text. */
export function tidy(text: string | undefined | null): string {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:•]+|[\s\-–—:•]+$/g, '')
    .trim();
}
