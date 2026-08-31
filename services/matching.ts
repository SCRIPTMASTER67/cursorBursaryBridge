import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { EligibilityService, MatchingService } from '@/lib/matching';
import type { EligibilityResult } from '@/lib/matching';
import { toMatchableProgramme, toMatchableStudent } from '@/lib/matching/adapters';
import type { MatchResult, MatchableProgramme, MatchableStudent } from '@/lib/matching';

/**
 * Data-loading layer for the matching engine.
 *
 * Responsible for shaping database rows into the plain projections the pure
 * engine consumes, and for turning the engine's output back into the view
 * models the UI renders. The engine itself never touches Prisma.
 */

const programmeInclude = {
  organisation: { select: { id: true, name: true, logoUrl: true, industry: true } },
  eligibility: true,
  supportedProgrammes: { include: { programme: { select: { id: true, name: true } } } },
  supportedInstitutions: { include: { institution: { select: { id: true, name: true, shortName: true } } } },
} satisfies Prisma.FundingProgrammeInclude;

export type ProgrammeWithRelations = Prisma.FundingProgrammeGetPayload<{
  include: typeof programmeInclude;
}>;

export type OpportunityMatch = {
  programme: ProgrammeWithRelations;
  match: MatchResult;
};

/** Load a student profile in the shape the engine expects. */
export async function loadMatchableStudent(
  studentProfileId: string,
): Promise<MatchableStudent | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: {
      currentProgrammeId: true,
      currentInstitutionId: true,
      qualificationLevel: true,
      academicAverage: true,
      province: true,
      householdIncome: true,
      citizenship: true,
      yearOfStudy: true,
      studyPreferences: {
        select: { preferenceNumber: true, programmeId: true, institutionId: true },
        orderBy: { preferenceNumber: 'asc' },
      },
    },
  });
  if (!profile) return null;

  return toMatchableStudent(profile);
}

export type OpportunityFilters = {
  search?: string;
  programmeIds?: string[];
  institutionIds?: string[];
  qualificationLevels?: string[];
  fundingTypes?: string[];
  provinces?: string[];
  coverage?: string[];
  minMatchScore?: number;
  closingBefore?: Date;
  includeClosed?: boolean;
};

/**
 * Every published, open funding programme scored for one student and returned
 * best-match first.
 *
 * Structural filters run in PostgreSQL; the match-score filter is applied after
 * scoring, because the score is derived rather than stored.
 */
export async function getRankedOpportunities(
  studentProfileId: string,
  filters: OpportunityFilters = {},
): Promise<OpportunityMatch[]> {
  const student = await loadMatchableStudent(studentProfileId);
  if (!student) return [];

  const where: Prisma.FundingProgrammeWhereInput = {
    status: 'PUBLISHED',
    ...(filters.includeClosed ? {} : { closingDate: { gte: startOfToday() } }),
  };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { shortDescription: { contains: filters.search, mode: 'insensitive' } },
      { organisation: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }
  if (filters.programmeIds?.length) {
    where.supportedProgrammes = { some: { programmeId: { in: filters.programmeIds } } };
  }
  if (filters.institutionIds?.length) {
    where.supportedInstitutions = { some: { institutionId: { in: filters.institutionIds } } };
  }
  if (filters.fundingTypes?.length) {
    where.fundingType = { in: filters.fundingTypes as Prisma.EnumFundingTypeFilter['in'] };
  }
  if (filters.coverage?.length) {
    where.coverage = { hasSome: filters.coverage as never };
  }
  if (filters.qualificationLevels?.length) {
    where.eligibility = {
      qualificationLevels: { hasSome: filters.qualificationLevels as never },
    };
  }
  if (filters.provinces?.length) {
    where.eligibility = {
      ...(where.eligibility as object),
      provinces: { hasSome: filters.provinces as never },
    };
  }
  if (filters.closingBefore) {
    where.closingDate = { ...(where.closingDate as object), lte: filters.closingBefore };
  }

  const programmes = await prisma.fundingProgramme.findMany({
    where,
    include: programmeInclude,
    orderBy: { closingDate: 'asc' },
  });

  const scored: OpportunityMatch[] = programmes
    .map((programme) => ({
      programme,
      match: MatchingService.score(student, toMatchableProgramme(programme)),
    }))
    .sort((a, b) => b.match.matchScore - a.match.matchScore);

  if (typeof filters.minMatchScore === 'number') {
    return scored.filter((item) => item.match.matchScore >= filters.minMatchScore!);
  }
  return scored;
}

/**
 * Score a single programme AND evaluate hard eligibility.
 *
 * Used at submission time so the funder-facing verdict is recorded alongside
 * the match snapshot, rather than inferred from the score afterwards.
 */
export async function getMatchAndEligibility(
  studentProfileId: string,
  fundingProgrammeId: string,
): Promise<(OpportunityMatch & { eligibility: EligibilityResult }) | null> {
  const result = await getMatchForProgramme(studentProfileId, fundingProgrammeId);
  if (!result) return null;

  const student = await loadMatchableStudent(studentProfileId);
  if (!student) return null;

  return {
    ...result,
    eligibility: EligibilityService.evaluate(student, toMatchableProgramme(result.programme)),
  };
}

/** Score a single programme for a student — used by the detail and apply pages. */
export async function getMatchForProgramme(
  studentProfileId: string,
  fundingProgrammeId: string,
): Promise<OpportunityMatch | null> {
  const [student, programme] = await Promise.all([
    loadMatchableStudent(studentProfileId),
    prisma.fundingProgramme.findUnique({
      where: { id: fundingProgrammeId },
      include: programmeInclude,
    }),
  ]);
  if (!student || !programme) return null;
  return { programme, match: MatchingService.score(student, toMatchableProgramme(programme)) };
}

export { programmeInclude, toMatchableProgramme };

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
