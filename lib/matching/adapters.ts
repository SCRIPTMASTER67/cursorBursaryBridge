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
  eligibility:
    | (Omit<EligibilityRow, 'subjectRequirements'> & {
        subjectRequirements?: {
          subjectId: string;
          minimumPercentage: number;
          subject?: { name: string } | null;
        }[];
      })
    | null;
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
          // A requirement whose subject row was not loaded is dropped rather
          // than named "Unknown subject": a requirement we cannot describe
          // cannot be explained to a student either.
          subjectRequirements: (programme.eligibility.subjectRequirements ?? [])
            .filter((r) => Boolean(r.subject?.name))
            .map((r) => ({
              subjectId: r.subjectId,
              subjectName: r.subject!.name,
              minimumPercentage: r.minimumPercentage,
            })),
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
  subjectResults?: {
    subjectId: string;
    percentage: number | null;
    year: number;
    subject?: { name: string } | null;
  }[];
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
    subjectResults: (profile.subjectResults ?? [])
      .filter((r) => Boolean(r.subject?.name))
      .map((r) => ({
        subjectId: r.subjectId,
        subjectName: r.subject!.name,
        percentage: r.percentage,
        year: r.year,
      })),
  };
}
