import type { IncomeBand, QualificationLevel } from '@prisma/client';

/**
 * Writing a motivational letter.
 *
 * Everything in a letter comes from one of two places: a fact already in the
 * student's profile, or a sentence the student wrote themselves. There is no
 * third source. A generator that could not answer a question leaves that
 * paragraph out and the student is asked for it — a letter claiming an
 * achievement the student never mentioned would be a lie sent under their name.
 */

export type LetterFacts = {
  firstName: string;
  lastName: string;
  /** Null when the student has not said, in which case it is not mentioned. */
  qualificationLevel: QualificationLevel | null;
  programmeName: string | null;
  institutionName: string | null;
  yearOfStudy: number | null;
  academicAverage: number | null;
  householdIncome: IncomeBand | null;
  province: string | null;
  /** Their strongest results, already filtered to ones they actually entered. */
  results: { subjectName: string; percentage: number; year: number }[];
  careerInterests: string[];
  achievements: string[];
};

export type LetterOpportunity = {
  name: string;
  organisationName: string;
  fundingType: string;
  /** What the funder says it covers, in the funder's own terms. */
  coverage: string[];
  fieldsOfStudy: string[];
  /** Subject minimums the funder states, so a met requirement can be cited. */
  subjectRequirements: { subjectName: string; minimumPercentage: number }[];
  minimumAverage: number | null;
};

/** The student's own words. Every key is optional; nothing is required. */
export type LetterAnswers = {
  whyApplying?: string;
  goals?: string;
  whyThisField?: string;
  fundingChallenges?: string;
  proudestAchievement?: string;
  whySuitable?: string;
  howItHelps?: string;
};

export type LetterInput = {
  facts: LetterFacts;
  opportunity: LetterOpportunity;
  answers: LetterAnswers;
};

/**
 * The seam where a different writer can be substituted.
 *
 * The built-in implementation composes the letter deterministically from the
 * facts and the student's own sentences. That is a deliberate choice rather
 * than a limitation accepted quietly: a composer cannot invent an achievement,
 * and its output can be traced line by line to something the student actually
 * said. A model-backed writer can be added here without anything else
 * changing, provided it honours the same rule.
 */
export interface LetterProvider {
  readonly name: string;
  compose(input: LetterInput): { content: string; usedAnswers: (keyof LetterAnswers)[] };
}

/** A gap worth asking the student about before generating. */
export type LetterGap = {
  key: keyof LetterAnswers | 'profile';
  question: string;
  /** Why the letter is weaker without it. */
  because: string;
};
