import { politeFetch } from './http';
import { parseListing } from './parse';
import { readAvailability, readDeadline } from './normalise';
import { dedupeKey } from './dedupe';
import { validate, type ValidatedOpportunity } from './validate';
import { enabledSources, type RegisteredSource } from './source-registry';
import type { Rejection } from './types';
import type { Availability, DeadlineKind } from '@prisma/client';

/**
 * One pass over the enabled sources.
 *
 * The pipeline is pure with respect to the database: it produces candidates
 * and reasons, and a caller decides what to write. That separation is what
 * makes it testable without a network or a database, and it is why the
 * "no egress" case is a reported outcome rather than a silent zero.
 */

export type Candidate = {
  value: ValidatedOpportunity;
  dedupeKey: string;
  openDate: Date | null;
  closingDate: Date | null;
  deadlineKind: DeadlineKind;
  deadlineNote: string | null;
  availability: Availability;
  availabilityReason: string;
  applicationFormUrl: string | null;
  warnings: string[];
};

export type SourceOutcome = {
  source: RegisteredSource;
  status: 'ok' | 'blocked-by-robots' | 'no-egress' | 'failed';
  detail: string;
  pagesRead: number;
  candidates: Candidate[];
  rejections: Rejection[];
};

export type PipelineOptions = {
  /** How many detail pages to follow per source. */
  maxDetailPages?: number;
  /** Supply pages instead of fetching them, for tests and offline imports. */
  fetcher?: (
    url: string,
  ) => Promise<
    { ok: true; body: string; url: string } | { ok: false; reason: string; kind: string }
  >;
  now?: Date;
};

export async function runIngestion(options: PipelineOptions = {}): Promise<SourceOutcome[]> {
  const sources = enabledSources();
  const outcomes: SourceOutcome[] = [];
  for (const source of sources) {
    outcomes.push(await runSource(source, options));
  }
  return outcomes;
}

export async function runSource(
  source: RegisteredSource,
  options: PipelineOptions = {},
): Promise<SourceOutcome> {
  const fetcher = options.fetcher ?? ((url: string) => politeFetch(url));
  const maxDetail = options.maxDetailPages ?? 25;

  const candidates: Candidate[] = [];
  const rejections: Rejection[] = [];
  let pagesRead = 0;
  const seenUrls = new Set<string>();

  for (const listingUrl of source.listingUrls) {
    const listing = await fetcher(listingUrl);
    if (!listing.ok) {
      return {
        source,
        status: statusFor(listing.kind),
        detail: listing.reason,
        pagesRead,
        candidates,
        rejections,
      };
    }
    pagesRead += 1;
    seenUrls.add(listingUrl);

    const parsed = parseListing(listing.body, listing.url, source);
    collect(parsed.opportunities, candidates, rejections, options.now);

    // Follow the listing's own links to the pages that carry the detail.
    for (const link of parsed.detailLinks.slice(0, maxDetail)) {
      if (seenUrls.has(link)) continue;
      seenUrls.add(link);

      const detail = await fetcher(link);
      if (!detail.ok) {
        // One unreachable page is not a failed source.
        rejections.push({ title: '(detail page)', sourceUrl: link, reason: detail.reason });
        continue;
      }
      pagesRead += 1;
      const detailParsed = parseListing(detail.body, detail.url, source);
      collect(detailParsed.opportunities, candidates, rejections, options.now);
    }
  }

  return {
    source,
    status: 'ok',
    detail: `${pagesRead} page(s) read, ${candidates.length} candidate(s), ${rejections.length} rejected.`,
    pagesRead,
    candidates,
    rejections,
  };
}

function collect(
  raws: Parameters<typeof validate>[0][],
  into: Candidate[],
  rejections: Rejection[],
  now?: Date,
) {
  for (const raw of raws) {
    const checked = validate(raw);
    if (!checked.ok) {
      rejections.push({
        title: raw.title ?? '(untitled)',
        sourceUrl: raw.sourceUrl ?? '',
        reason: checked.reason,
      });
      continue;
    }

    const closing = readDeadline(raw.closingDateText);
    const opening = readDeadline(raw.openDateText);
    const availability = readAvailability({
      statusText: raw.statusText,
      openDate: opening.date,
      closingDate: closing.date,
      deadlineKind: closing.kind,
      now,
    });

    into.push({
      value: checked.value,
      dedupeKey: dedupeKey({
        organisationName: checked.value.organisationName,
        title: checked.value.title,
        closingDate: closing.date,
      }),
      openDate: opening.date,
      closingDate: closing.date,
      deadlineKind: closing.kind,
      deadlineNote: closing.note,
      availability: availability.availability,
      availabilityReason: availability.because,
      applicationFormUrl: raw.applicationFormUrl ?? null,
      warnings: checked.warnings,
    });
  }
}

function statusFor(kind: string): SourceOutcome['status'] {
  if (kind === 'blocked-by-robots') return 'blocked-by-robots';
  if (kind === 'no-egress') return 'no-egress';
  return 'failed';
}
