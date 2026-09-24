import type { CriterionKey } from './types';

/**
 * Scoring configuration for the prototype engine.
 *
 * All tuning lives here so the weights can be changed — or loaded per funder by
 * a future rules engine — without touching evaluation logic or the UI.
 */
export const CRITERION_WEIGHTS: Record<CriterionKey, number> = {
  course: 28,
  institution: 22,
  academic: 18,
  // Subject requirements are specific and verifiable, so they carry real
  // weight: a bursary asking for Mathematics at 70% is making a harder claim
  // than one asking for a 70% average, and a student who meets it should be
  // scored for it.
  subjects: 12,
  qualification: 8,
  location: 8,
  financial: 4,
};

export const TOTAL_WEIGHT = Object.values(CRITERION_WEIGHTS).reduce((sum, w) => sum + w, 0);

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  course: 'Course',
  institution: 'Institution',
  academic: 'Academic requirement',
  subjects: 'Subject requirements',
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

/**
 * A funder's own weighting.
 *
 * The defaults above are a reasonable opinion about what matters, but they are
 * ours, not the funder's: a bursary that exists to widen access weighs
 * financial need very differently from one recruiting engineers. A programme
 * may therefore override any subset of the criteria, and whatever it does not
 * mention keeps the default.
 *
 * Weights are relative, not percentages — they are summed and each criterion
 * is scored as its share of that total — so a funder cannot produce an
 * impossible configuration by failing to make their numbers add to a hundred.
 */
export function resolveWeights(
  overrides?: Partial<Record<CriterionKey, number>>,
): Record<CriterionKey, number> {
  if (!overrides) return CRITERION_WEIGHTS;

  const resolved = { ...CRITERION_WEIGHTS };
  for (const [key, weight] of Object.entries(overrides)) {
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) continue;
    resolved[key as CriterionKey] = Math.round(weight);
  }

  // A configuration that zeroes everything would divide by zero and score
  // every applicant identically, which is not a preference anyone can have
  // meant. Fall back rather than produce nonsense.
  const total = Object.values(resolved).reduce((sum, weight) => sum + weight, 0);
  return total > 0 ? resolved : CRITERION_WEIGHTS;
}
