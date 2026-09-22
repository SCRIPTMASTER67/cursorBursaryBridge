import 'server-only';
import type {
  CareerInterest,
  FundingType,
  Prisma,
  Province,
  QualificationLevel,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { displayStatus, STATUS_ORDER, type DisplayStatus } from '@/lib/bursary-status';

/**
 * The complete bursary directory.
 *
 * Deliberately NOT personalised. A student browsing here sees every
 * opportunity Bursary-Bridge holds, including ones they do not qualify for and
 * ones that have closed, because knowing who funds what and when to come back
 * is useful on its own. Personalised matching lives in the matching service
 * and is a separate experience.
 *
 * Every count returned comes from a query. There are no illustrative figures.
 */

export type DirectoryFilters = {
  search?: string;
  status?: DisplayStatus | 'ALL';
  fundingType?: FundingType;
  field?: CareerInterest;
  province?: Province;
  qualification?: QualificationLevel;
  institutionId?: string;
  page?: number;
};

export const PAGE_SIZE = 12;

const LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  fundingType: true,
  coverage: true,
  openDate: true,
  closingDate: true,
  deadlineKind: true,
  deadlineNote: true,
  availability: true,
  verificationStatus: true,
  lastVerifiedAt: true,
  origin: true,
  sourceName: true,
  sourceUrl: true,
  officialSource: true,
  applicationUrl: true,
  organisation: { select: { id: true, name: true, logoUrl: true, industry: true, origin: true } },
  supportedProgrammes: { select: { programme: { select: { id: true, name: true, field: true } } } },
  supportedInstitutions: {
    select: { institution: { select: { id: true, name: true, shortName: true, province: true } } },
  },
  eligibility: { select: { qualificationLevels: true, provinces: true, minAcademicAverage: true } },
  _count: { select: { applicationForms: true } },
} satisfies Prisma.FundingProgrammeSelect;

export type DirectoryRow = Prisma.FundingProgrammeGetPayload<{ select: typeof LIST_SELECT }> & {
  status: DisplayStatus;
};

/**
 * Only opportunities meant to be seen.
 *
 * A draft has not been published by its funder, and a suspended one was
 * withdrawn by an administrator. Neither is hidden because it is closed —
 * closed opportunities stay in the directory by design.
 */
const VISIBLE: Prisma.FundingProgrammeWhereInput = {
  status: { in: ['PUBLISHED', 'CLOSED'] },
};

export async function listDirectory(filters: DirectoryFilters) {
  const where: Prisma.FundingProgrammeWhereInput = { ...VISIBLE };
  const and: Prisma.FundingProgrammeWhereInput[] = [];

  if (filters.search?.trim()) {
    const term = filters.search.trim();
    and.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { shortDescription: { contains: term, mode: 'insensitive' } },
        { fullDescription: { contains: term, mode: 'insensitive' } },
        { organisation: { name: { contains: term, mode: 'insensitive' } } },
        {
          supportedProgrammes: {
            some: { programme: { name: { contains: term, mode: 'insensitive' } } },
          },
        },
        {
          supportedInstitutions: {
            some: { institution: { name: { contains: term, mode: 'insensitive' } } },
          },
        },
      ],
    });
  }
  if (filters.fundingType) and.push({ fundingType: filters.fundingType });
  if (filters.field)
    and.push({ supportedProgrammes: { some: { programme: { field: filters.field } } } });
  if (filters.institutionId) {
    and.push({ supportedInstitutions: { some: { institutionId: filters.institutionId } } });
  }
  if (filters.province) {
    and.push({
      OR: [
        { eligibility: { provinces: { has: filters.province } } },
        { supportedInstitutions: { some: { institution: { province: filters.province } } } },
      ],
    });
  }
  if (filters.qualification) {
    and.push({ eligibility: { qualificationLevels: { has: filters.qualification } } });
  }
  if (and.length > 0) where.AND = and;

  // Status is derived rather than stored as a display value, so it is applied
  // after the query rather than in it. The result set is bounded by the other
  // filters, and correctness matters more here than a single-query plan.
  const rows = await prisma.fundingProgramme.findMany({
    where,
    select: LIST_SELECT,
    orderBy: [{ closingDate: 'asc' }, { name: 'asc' }],
  });

  const now = new Date();
  const withStatus: DirectoryRow[] = rows.map((row) => ({
    ...row,
    status: displayStatus(row, now),
  }));

  const counts = countByStatus(withStatus);

  const filtered =
    filters.status && filters.status !== 'ALL'
      ? withStatus.filter((row) => row.status === filters.status)
      : withStatus;

  // Open first, then the ones a student might act on later, then closed.
  const ordered = [...filtered].sort((a, b) => {
    const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (byStatus !== 0) return byStatus;
    if (a.closingDate && b.closingDate) return a.closingDate.getTime() - b.closingDate.getTime();
    if (a.closingDate) return -1;
    if (b.closingDate) return 1;
    return a.name.localeCompare(b.name);
  });

  const page = Math.max(1, filters.page ?? 1);
  const start = (page - 1) * PAGE_SIZE;

  return {
    rows: ordered.slice(start, start + PAGE_SIZE),
    total: ordered.length,
    page,
    pageCount: Math.max(1, Math.ceil(ordered.length / PAGE_SIZE)),
    counts,
  };
}

export type StatusCounts = Record<DisplayStatus | 'ALL', number>;

function countByStatus(rows: DirectoryRow[]): StatusCounts {
  const counts: StatusCounts = {
    ALL: rows.length,
    OPEN: 0,
    UPCOMING: 0,
    NEEDS_VERIFICATION: 0,
    UNKNOWN: 0,
    CLOSED: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/**
 * The filter options, built from what is actually in the database.
 *
 * A filter that cannot match anything is not offered: an empty dropdown of
 * twenty provinces on a directory holding three bursaries is a lie about how
 * much is there.
 */
export async function directoryFacets() {
  const [fields, institutions, provinces, fundingTypes] = await Promise.all([
    prisma.fundingProgrammeProgramme.findMany({
      where: { fundingProgramme: VISIBLE },
      select: { programme: { select: { field: true } } },
      distinct: ['programmeId'],
    }),
    prisma.fundingProgrammeInstitution.findMany({
      where: { fundingProgramme: VISIBLE },
      select: { institution: { select: { id: true, name: true, shortName: true } } },
      distinct: ['institutionId'],
    }),
    prisma.eligibilityRule.findMany({
      where: { fundingProgramme: VISIBLE },
      select: { provinces: true },
    }),
    prisma.fundingProgramme.findMany({
      where: VISIBLE,
      select: { fundingType: true },
      distinct: ['fundingType'],
    }),
  ]);

  return {
    fields: [...new Set(fields.map((f) => f.programme.field))].sort(),
    institutions: institutions
      .map((i) => i.institution)
      .sort((a, b) => a.name.localeCompare(b.name)),
    provinces: [...new Set(provinces.flatMap((p) => p.provinces))].sort(),
    fundingTypes: fundingTypes.map((f) => f.fundingType).sort(),
  };
}

const DETAIL_SELECT = {
  ...LIST_SELECT,
  fullDescription: true,
  intakeTarget: true,
  lastCheckedAt: true,
  sourceType: true,
  createdAt: true,
  organisation: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      industry: true,
      description: true,
      website: true,
      origin: true,
      sourceUrl: true,
    },
  },
  eligibility: true,
  sources: {
    select: {
      url: true,
      name: true,
      type: true,
      official: true,
      isPrimary: true,
      lastVerifiedAt: true,
    },
    orderBy: { isPrimary: 'desc' },
  },
  applicationForms: {
    select: {
      id: true,
      name: true,
      fileType: true,
      sizeBytes: true,
      sourceUrl: true,
      fileUrl: true,
      storageKey: true,
      providedBy: true,
      official: true,
      lastVerifiedAt: true,
    },
  },
} satisfies Prisma.FundingProgrammeSelect;

export type DirectoryDetail = Prisma.FundingProgrammeGetPayload<{
  select: typeof DETAIL_SELECT;
}> & {
  status: DisplayStatus;
};

export async function getDirectoryEntry(slug: string): Promise<DirectoryDetail | null> {
  const row = await prisma.fundingProgramme.findFirst({
    where: { slug, ...VISIBLE },
    select: DETAIL_SELECT,
  });
  if (!row) return null;
  return { ...row, status: displayStatus(row) };
}

/** Headline numbers for the directory. Every one is a query. */
export async function directoryTotals() {
  const rows = await prisma.fundingProgramme.findMany({
    where: VISIBLE,
    select: {
      availability: true,
      verificationStatus: true,
      lastVerifiedAt: true,
      origin: true,
    },
  });
  const now = new Date();
  const counts = countByStatus(
    rows.map((row) => ({ ...row, status: displayStatus(row, now) })) as DirectoryRow[],
  );

  const lastRun = await prisma.ingestionRun.findFirst({
    orderBy: { startedAt: 'desc' },
    select: { status: true, finishedAt: true, startedAt: true, notes: true },
  });

  return { counts, lastRun };
}
