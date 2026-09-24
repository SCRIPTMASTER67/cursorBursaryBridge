import type { MatchClassification } from '@prisma/client';
import {
  MAX_UNKNOWN_WEIGHT,
  POTENTIAL_MATCH_THRESHOLD,
  STRONG_MATCH_THRESHOLD,
  TOTAL_WEIGHT,
  resolveWeights,
} from './config';
import {
  evaluateAcademic,
  evaluateCourse,
  evaluateFinancial,
  evaluateInstitution,
  evaluateLocation,
  evaluateQualification,
  evaluateSubjects,
  selectBestPreference,
} from './criteria';
import type {
  CriterionKey,
  CriterionResult,
  MatchResult,
  MatchableProgramme,
  MatchableStudent,
} from './types';

export type ScoreOptions = {
  /**
   * A programme's own weighting for the criteria. Anything not named keeps the
   * platform default, so a funder configures only what they care about.
   */
  weights?: Partial<Record<CriterionKey, number>>;
};

/**
 * Re-weight a criterion without re-evaluating it.
 *
 * Each criterion decides independently whether it is met, and how completely —
 * that judgement does not change because a funder cares about it more. So the
 * result is scaled by the share it earned of its default weight, which keeps
 * one evaluation path for both the platform's weighting and a funder's.
 */
function reweight(criterion: CriterionResult, weight: number): CriterionResult {
  if (weight === criterion.weight) return criterion;
  const share = criterion.weight === 0 ? 0 : criterion.awarded / criterion.weight;
  return { ...criterion, weight, awarded: Math.round(share * weight * 100) / 100 };
}

/**
 * MatchingService — the prototype scoring engine.
 *
 * Pure and synchronous: it takes plain projections and returns a score with its
 * justification. All data loading lives in `services/matching.ts`, and no
 * scoring rule appears anywhere in the React tree.
 *
 * The seven steps are deliberately explicit so a future eligibility engine can
 * replace `score()` while keeping the same contract.
 */
export const MatchingService = {
  score(
    student: MatchableStudent,
    programme: MatchableProgramme,
    options: ScoreOptions = {},
  ): MatchResult {
    const eligibility = programme.eligibility;
    const weights = resolveWeights(options.weights);
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

    // 1. Decide which of the student's preferences this programme is judged on.
    const preferenceMatch = selectBestPreference(student, programme);

    // 2. Evaluate every weighted criterion independently.
    const criteria = [
      evaluateCourse(preferenceMatch),
      evaluateInstitution(preferenceMatch),
      evaluateAcademic(student, eligibility),
      evaluateSubjects(student, eligibility),
      evaluateQualification(student, eligibility),
      evaluateLocation(student, eligibility),
      evaluateFinancial(student, eligibility),
    ].map((criterion) => reweight(criterion, weights[criterion.key]));

    // 3. Sum the awarded points into a 0–100 score.
    const awarded = criteria.reduce((sum, c) => sum + c.awarded, 0);
    const matchScore = Math.round((awarded / totalWeight) * 100);

    // 4. Work out how much of the profile we could not evaluate.
    const unknownWeight = criteria
      .filter((c) => c.status === 'UNKNOWN')
      .reduce((sum, c) => sum + c.weight, 0);

    const hasNoPreferences = student.studyPreferences.length === 0 && !student.currentProgrammeId;

    const needsMoreInformation = unknownWeight > MAX_UNKNOWN_WEIGHT || hasNoPreferences;

    // 5. Classify.
    const classification = classify(matchScore, needsMoreInformation);

    // 6. Build the student-facing "why this match?" list.
    const reasons = criteria.filter((c) => c.status === 'MET').map((c) => c.reason);

    return { matchScore, classification, reasons, criteria, needsMoreInformation };
  },

  /** Score one student against many programmes, ranked best-first. */
  rank<T extends MatchableProgramme>(
    student: MatchableStudent,
    programmes: T[],
  ): Array<{ programme: T; match: MatchResult }> {
    return programmes
      .map((programme) => ({ programme, match: MatchingService.score(student, programme) }))
      .sort((a, b) => b.match.matchScore - a.match.matchScore);
  },
};

export function classify(score: number, needsMoreInformation: boolean): MatchClassification {
  if (needsMoreInformation) return 'MORE_INFO_NEEDED';
  if (score >= STRONG_MATCH_THRESHOLD) return 'STRONG_MATCH';
  if (score >= POTENTIAL_MATCH_THRESHOLD) return 'POTENTIAL_MATCH';
  return 'MORE_INFO_NEEDED';
}
