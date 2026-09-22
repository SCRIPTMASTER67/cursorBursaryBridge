import { createHash } from 'node:crypto';

/**
 * Recognising the same bursary twice.
 *
 * "XYZ Bursary", "XYZ Corporation Bursary" and "XYZ Bursary 2027" listed on
 * three sites are one opportunity, not three. The key below is deliberately
 * coarse — organisation, the programme name with its noise removed, and the
 * application cycle — so that near-identical listings collapse, while two
 * genuinely different programmes from the same funder stay apart.
 */

const NOISE =
  /\b(bursary|bursaries|scholarship|scholarships|grant|grants|programme|program|fund|funding|application|applications|20\d{2}|intake|cycle|south africa|sa|pty|ltd|limited|holdings|group|foundation|trust|inc|corporation|corp)\b/gi;

/** Reduce a name to the words that actually identify it. */
export function identityWords(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(NOISE, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The cycle a listing belongs to.
 *
 * Taken from a year in the title when there is one, otherwise from the closing
 * date. Two listings of the same programme for different years are different
 * opportunities and must not be merged.
 */
export function cycleOf(title: string, closingDate: Date | null): string {
  const inTitle = /\b(20\d{2})\b/.exec(title);
  if (inTitle) return inTitle[1];
  if (closingDate) return String(closingDate.getUTCFullYear());
  return 'unknown';
}

export function dedupeKey(input: {
  organisationName: string;
  title: string;
  closingDate: Date | null;
}): string {
  const org = identityWords(input.organisationName) || input.organisationName.toLowerCase().trim();
  const name = identityWords(input.title);
  const cycle = cycleOf(input.title, input.closingDate);
  const basis = `${org}|${name}|${cycle}`;
  return createHash('sha256').update(basis).digest('hex').slice(0, 32);
}

/** A stable fingerprint of extracted content, for spotting an unchanged page. */
export function contentHash(parts: (string | null | undefined)[]): string {
  return createHash('sha256')
    .update(parts.map((p) => p ?? '').join('\u0000'))
    .digest('hex');
}

/**
 * How alike two titles are, 0 to 1.
 *
 * Used as a second opinion when the keys differ but the listings look like the
 * same thing. A near-match is flagged for a person rather than merged: merging
 * two real opportunities loses one of them, which is worse than a duplicate.
 */
export function titleSimilarity(a: string, b: string): number {
  const left = new Set(identityWords(a).split(' ').filter(Boolean));
  const right = new Set(identityWords(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

export const NEAR_DUPLICATE_THRESHOLD = 0.8;
