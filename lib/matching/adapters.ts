import type { MatchableProgramme, MatchableStudent } from './types';

/**
 * Adapters between database rows and the plain projections the pure engine
 * consumes.
 *
 * Kept free of `server-only` so the seed script and unit tests can reuse them
 * outside the Next.js server runtime.
 */

type EligibilityRow = NonNullable<MatchableProgramme['eligibility']>;

export function toMatchableProgramme(programme: {
  id: string;
  supportedProgrammes: { programmeId: string }[];
  supportedInstitutions: { institutionId: string }[];
  eligibility: EligibilityRow | null;
}): MatchableProgramme {
  return {
    id: programme.id,
    supportedProgrammeIds: programme.supportedProgrammes.map((p) => p.programmeId),
    supportedInstitutionIds: programme.supportedInstitutions.map((i) => i.institutionId),
    eligibility: programme.eligibility
      ? {
          minAcademicAverage: programme.eligibility.minAcademicAverage,
          qualificationLevels: programme.eligibility.qualificationLevels,
          yearsOfStudy: programme.eligibility.yearsOfStudy,
          citizenship: programme.eligibility.citizenship,
          maxHouseholdIncome: programme.eligibility.maxHouseholdIncome,
          requiresFinancialNeed: programme.eligibility.requiresFinancialNeed,
          provinces: programme.eligibility.provinces,
        }
      : null,
  };
}

export function toMatchableStudent(profile: {
  currentProgrammeId: string | null;
  currentInstitutionId: string | null;
  qualificationLevel: MatchableStudent['qualificationLevel'];
  academicAverage: number | null;
  province: MatchableStudent['province'];
  householdIncome: MatchableStudent['householdIncome'];
  citizenship: MatchableStudent['citizenship'];
  yearOfStudy: number | null;
  studyPreferences: { preferenceNumber: number; programmeId: string; institutionId: string }[];
}): MatchableStudent {
  return {
    studyPreferences: profile.studyPreferences,
    currentProgrammeId: profile.currentProgrammeId,
    currentInstitutionId: profile.currentInstitutionId,
    qualificationLevel: profile.qualificationLevel,
    academicAverage: profile.academicAverage,
    province: profile.province,
    householdIncome: profile.householdIncome,
    citizenship: profile.citizenship,
    yearOfStudy: profile.yearOfStudy,
  };
}
