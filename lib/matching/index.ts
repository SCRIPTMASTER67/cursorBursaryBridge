export { MatchingService, classify } from './engine';
export { EligibilityService, eligibilityOutcomeLabels } from './eligibility';
export type { EligibilityOutcome, EligibilityResult } from './eligibility';
export {
  CRITERION_WEIGHTS,
  CRITERION_LABELS,
  TOTAL_WEIGHT,
  STRONG_MATCH_THRESHOLD,
  POTENTIAL_MATCH_THRESHOLD,
} from './config';
export type {
  CriterionKey,
  CriterionResult,
  CriterionStatus,
  MatchResult,
  MatchableEligibility,
  MatchablePreference,
  MatchableProgramme,
  MatchableStudent,
} from './types';
