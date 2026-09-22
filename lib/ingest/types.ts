import type { SourceType } from '@prisma/client';

/**
 * The shape of an opportunity as it travels through the pipeline.
 *
 * Everything optional is genuinely optional. A source that does not state a
 * deadline leaves `closingDate` null; it is never filled in to make a record
 * look complete. Validation later refuses a record that lacks the few things
 * an opportunity cannot exist without — which is the point at which an
 * invented bursary would be caught.
 */

export type RawOpportunity = {
  /** Exactly as the source words it. */
  title: string;
  organisationName: string;
  /** The page this was read from. */
  sourceUrl: string;
  sourceName: string;
  sourceType: SourceType;
  official: boolean;

  /** Everything below is only set when the source actually says it. */
  description?: string;
  fundingTypeText?: string;
  coverageText?: string;
  openDateText?: string;
  closingDateText?: string;
  statusText?: string;
  applicationUrl?: string;
  fieldsOfStudyText?: string;
  institutionsText?: string;
  requirementsText?: string;
  documentsText?: string;
  provincesText?: string;
  citizenshipText?: string;
  minAverageText?: string;
  applicationFormUrl?: string;

  /** Hash of the extracted content, so an unchanged page is cheap to skip. */
  contentHash: string;
  /** When this was read. */
  readAt: Date;
};

/** A reason a candidate was refused. Kept so a run can explain itself. */
export type Rejection = {
  title: string;
  sourceUrl: string;
  reason: string;
};

export type FetchOutcome =
  | { ok: true; status: number; body: string; url: string }
  | { ok: false; reason: string; kind: 'blocked-by-robots' | 'no-egress' | 'http' | 'error' };
