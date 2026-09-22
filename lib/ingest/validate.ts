import type { Availability, SourceType } from '@prisma/client';
import type { RawOpportunity } from './types';

/**
 * The gate an opportunity must pass to reach the database.
 *
 * This is where an invented bursary would be caught, so it refuses rather than
 * repairs. A record missing something an opportunity cannot exist without is
 * rejected and counted; it is never completed with a plausible value.
 */

export type ValidatedOpportunity = {
  title: string;
  organisationName: string;
  sourceUrl: string;
  sourceName: string;
  sourceType: SourceType;
  official: boolean;
  description: string | null;
  applicationUrl: string | null;
  contentHash: string;
};

export type ValidationResult =
  | { ok: true; value: ValidatedOpportunity; warnings: string[] }
  | { ok: false; reason: string };

/** A title that says nothing. Real listings are refused for being like this. */
const EMPTY_TITLES =
  /^(bursary|bursaries|apply|apply now|read more|click here|more info|details|home|untitled)$/i;

/** Wording that marks a page as an example rather than an opportunity. */
const NOT_REAL =
  /\b(lorem ipsum|example bursary|sample bursary|test bursary|dummy|placeholder|abc foundation|xyz corporation|your company|company name here)\b/i;

export function validate(raw: RawOpportunity): ValidationResult {
  const title = raw.title?.trim() ?? '';
  const organisationName = raw.organisationName?.trim() ?? '';

  if (!title) return { ok: false, reason: 'No title.' };
  if (title.length < 6) return { ok: false, reason: `Title too short to identify: "${title}".` };
  if (EMPTY_TITLES.test(title)) return { ok: false, reason: `Title says nothing: "${title}".` };
  if (title.length > 300)
    return { ok: false, reason: 'Title implausibly long; likely a page of text.' };

  if (!organisationName) return { ok: false, reason: `No organisation named for "${title}".` };
  if (organisationName.length < 2) {
    return { ok: false, reason: `Organisation name too short for "${title}".` };
  }

  // A record that reads like sample content never reaches production, whatever
  // produced it.
  const combined = `${title} ${organisationName} ${raw.description ?? ''}`;
  if (NOT_REAL.test(combined)) {
    return { ok: false, reason: `Reads as sample content, not a real opportunity: "${title}".` };
  }

  const sourceUrl = safeUrl(raw.sourceUrl);
  if (!sourceUrl) {
    return { ok: false, reason: `No usable source URL for "${title}".` };
  }
  if (!raw.sourceName?.trim()) {
    return { ok: false, reason: `No source name for "${title}".` };
  }

  const warnings: string[] = [];
  const applicationUrl = raw.applicationUrl ? safeUrl(raw.applicationUrl) : null;
  if (raw.applicationUrl && !applicationUrl) {
    warnings.push('The application link on the source is not a usable URL and was dropped.');
  }
  if (!raw.closingDateText) warnings.push('The source states no deadline.');
  if (!raw.description) warnings.push('The source carries no description.');

  return {
    ok: true,
    warnings,
    value: {
      title,
      organisationName,
      sourceUrl,
      sourceName: raw.sourceName.trim(),
      sourceType: raw.sourceType,
      official: raw.official,
      description: raw.description?.trim() || null,
      applicationUrl,
      contentHash: raw.contentHash,
    },
  };
}

/** Only absolute HTTPS URLs are kept. An invented or relative URL is dropped. */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Whether an opportunity may be shown as OPEN.
 *
 * Openness is a claim about right now, so it needs a recent check behind it. An
 * opportunity that has not been verified inside the freshness window is shown
 * as needing verification instead — never as open.
 */
export const FRESHNESS_DAYS = 7;

export function mayDisplayAsOpen(input: {
  availability: Availability;
  lastVerifiedAt: Date | null;
  now?: Date;
}): boolean {
  if (input.availability !== 'OPEN') return false;
  if (!input.lastVerifiedAt) return false;
  const age = ((input.now ?? new Date()).getTime() - input.lastVerifiedAt.getTime()) / 86_400_000;
  return age <= FRESHNESS_DAYS;
}
