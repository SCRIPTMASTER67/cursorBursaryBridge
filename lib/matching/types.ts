import type {
  Citizenship,
  IncomeBand,
  MatchClassification,
  Province,
  QualificationLevel,
} from '@prisma/client';

/** The seven weighted criteria the engine evaluates. */
export type CriterionKey =
  | 'course'
  | 'institution'
  | 'academic'
  | 'subjects'
  | 'qualification'
  | 'location'
  | 'financial';

export type CriterionStatus = 'MET' | 'NOT_MET' | 'UNKNOWN';

export type CriterionResult = {
  key: CriterionKey;
  label: string;
  weight: number;
  status: CriterionStatus;
  /** Points awarded out of `weight`. */
  awarded: number;
  /** Student-facing explanation — this is what powers "Why this match?". */
  reason: string;
};

export type MatchResult = {
  matchScore: number;
  classification: MatchClassification;
  /** Short affirmative phrases for the compact "why you match" list. */
  reasons: string[];
  /** Full per-criterion breakdown for the opportunity detail page. */
  criteria: CriterionResult[];
  /** True when missing profile data materially limited the score. */
  needsMoreInformation: boolean;
};

/**
 * One subject or module result, reduced to what the engine compares.
 *
 * `percentage` is nullable because a student may have entered the subject
 * without the mark. That is a real state and not the same as a zero, so a
 * requirement measured against it is UNKNOWN rather than failed.
 */
export type MatchableSubjectResult = {
  subjectId: string;
  subjectName: string;
  percentage: number | null;
  year: number;
};

/** A subject mark a funder requires, e.g. Mathematics at 70%. */
export type MatchableSubjectRequirement = {
  subjectId: string;
  subjectName: string;
  minimumPercentage: number;
};

/** A student's study preference reduced to the ids the engine compares. */
export type MatchablePreference = {
  preferenceNumber: number;
  programmeId: string;
  institutionId: string;
};

/**
 * The projection of a student profile the engine needs. Keeping this separate
 * from the Prisma model means the engine can be unit-tested with plain objects
 * and later fed by a different data source.
 */
export type MatchableStudent = {
  studyPreferences: MatchablePreference[];
  currentProgrammeId: string | null;
  currentInstitutionId: string | null;
  qualificationLevel: QualificationLevel | null;
  academicAverage: number | null;
  province: Province | null;
  householdIncome: IncomeBand | null;
  citizenship: Citizenship | null;
  yearOfStudy: number | null;
  /** Individual subject and module results the student has entered. */
  subjectResults: MatchableSubjectResult[];
};

export type MatchableEligibility = {
  minAcademicAverage: number | null;
  qualificationLevels: QualificationLevel[];
  yearsOfStudy: number[];
  citizenship: Citizenship[];
  maxHouseholdIncome: IncomeBand | null;
  requiresFinancialNeed: boolean;
  provinces: Province[];
  /** Per-subject minimums, where the funder states any. */
  subjectRequirements: MatchableSubjectRequirement[];
};

export type MatchableProgramme = {
  id: string;
  supportedProgrammeIds: string[];
  supportedInstitutionIds: string[];
  eligibility: MatchableEligibility | null;
};

export type { MatchClassification };
