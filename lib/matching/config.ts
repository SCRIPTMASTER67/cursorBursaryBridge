import type { CriterionKey } from './types';

/**
 * Scoring configuration for the prototype engine.
 *
 * All tuning lives here so the weights can be changed — or loaded per funder by
 * a future rules engine — without touching evaluation logic or the UI.
 */
export const CRITERION_WEIGHTS: Record<CriterionKey, number> = {
  course: 30,
  institution: 25,
  academic: 20,
  qualification: 10,
  location: 10,
  financial: 5,
};

export const TOTAL_WEIGHT = Object.values(CRITERION_WEIGHTS).reduce((sum, w) => sum + w, 0);

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  course: 'Course',
  institution: 'Institution',
  academic: 'Academic requirement',
  qualification: 'Qualification level',
  location: 'Location requirement',
  financial: 'Financial requirement',
};

/**
 * A criterion we cannot evaluate earns partial credit rather than zero: the
 * student is not penalised as though they had failed, but the gap still pulls
 * the score down and is surfaced as "needs verification".
 */
export const UNKNOWN_CREDIT_RATIO = 0.5;

export const STRONG_MATCH_THRESHOLD = 85;
export const POTENTIAL_MATCH_THRESHOLD = 60;

/**
 * When this much weight is unevaluable, the result is reported as
 * "More information needed" no matter how the remaining criteria scored.
 */
export const MAX_UNKNOWN_WEIGHT = 25;
