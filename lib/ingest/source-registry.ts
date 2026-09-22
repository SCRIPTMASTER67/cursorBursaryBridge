import type { SourceType } from '@prisma/client';

/**
 * The sources the pipeline is allowed to read.
 *
 * A source is configuration, not data: naming a real public website here does
 * not create an opportunity, and nothing is fetched until the source's own
 * robots.txt has been read and consulted.
 *
 * Only sources the operator has explicitly authorised are enabled. The rest
 * are listed so the architecture is visible and so enabling one is a one-line
 * decision with a name attached — not an accident.
 */

export type AdapterId = 'listing-generic' | 'zabursaries';

export type RegisteredSource = {
  id: string;
  name: string;
  /** Position in the source hierarchy; the pipeline prefers the lowest level. */
  type: SourceType;
  /** True when this is the funder's own site. */
  official: boolean;
  homepage: string;
  /** Pages the pipeline reads. Each is robots-checked before it is fetched. */
  listingUrls: string[];
  adapter: AdapterId;
  /**
   * Off until an operator turns it on. Recording a source is not the same as
   * being authorised to read it.
   */
  enabled: boolean;
  /** Why it is on or off, in words, for the audit trail. */
  note: string;
};

export const SOURCES: RegisteredSource[] = [
  {
    id: 'zabursaries',
    name: 'ZA Bursaries',
    type: 'SECONDARY_PUBLICATION',
    official: false,
    homepage: 'https://www.zabursaries.co.za',
    listingUrls: ['https://www.zabursaries.co.za/'],
    adapter: 'zabursaries',
    enabled: true,
    note: 'Authorised by the operator. A listing publication, so level 3: anything it carries should be confirmed against the funder’s own site before it is treated as official.',
  },

  // Everything below is registered but NOT enabled. Each is a real, public
  // South African funding source, and each would be a legitimate level 1 or 2
  // source — but none has been authorised, and the pipeline will not read a
  // source nobody has named.
  {
    id: 'nsfas',
    name: 'NSFAS',
    type: 'OFFICIAL_INSTITUTION',
    official: true,
    homepage: 'https://www.nsfas.org.za',
    listingUrls: [],
    adapter: 'listing-generic',
    enabled: false,
    note: 'National government funding scheme. Not authorised; listing URLs deliberately left empty until an operator confirms which pages to read.',
  },
  {
    id: 'funza-lushaka',
    name: 'Funza Lushaka Bursary Programme',
    type: 'OFFICIAL_INSTITUTION',
    official: true,
    homepage: 'https://www.funzalushaka.doe.gov.za',
    listingUrls: [],
    adapter: 'listing-generic',
    enabled: false,
    note: 'Department of Basic Education teaching bursary. Not authorised.',
  },
];

export function enabledSources(): RegisteredSource[] {
  return SOURCES.filter((source) => source.enabled && source.listingUrls.length > 0);
}

export function sourceById(id: string): RegisteredSource | undefined {
  return SOURCES.find((source) => source.id === id);
}

/** Lower is more authoritative, matching the source hierarchy. */
export const SOURCE_LEVEL: Record<SourceType, number> = {
  OFFICIAL_ORGANISATION: 1,
  OFFICIAL_INSTITUTION: 2,
  SECONDARY_PUBLICATION: 3,
  OTHER: 4,
};

/** True when `candidate` should replace `current` as the primary source. */
export function outranks(candidate: SourceType, current: SourceType): boolean {
  return SOURCE_LEVEL[candidate] < SOURCE_LEVEL[current];
}
