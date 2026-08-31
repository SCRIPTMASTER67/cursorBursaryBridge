import type { CriterionResult, MatchableProgramme, MatchableStudent } from './types';
import {
  evaluateAcademic,
  evaluateCourse,
  evaluateFinancial,
  evaluateInstitution,
  evaluateLocation,
  evaluateQualification,
  selectBestPreference,
} from './criteria';

export type EligibilityOutcome = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'PENDING_VERIFICATION';

export type EligibilityResult = {
  outcome: EligibilityOutcome;
  /** Criteria the applicant fails outright. */
  failed: CriterionResult[];
  /** Criteria we cannot decide without more information or a document. */
  pending: CriterionResult[];
  criteria: CriterionResult[];
};

/**
 * EligibilityService — the hard pass/fail view used by funders.
 *
 * Distinct from MatchingService on purpose: matching produces a ranked,
 * fuzzy score for students, while eligibility answers the funder's binary
 * question "does this applicant meet our stated rules?". Missing information
 * is never an automatic rejection — it surfaces as PENDING_VERIFICATION so a
 * reviewer can request the document instead.
 */
export const EligibilityService = {
  evaluate(student: MatchableStudent, programme: MatchableProgramme): EligibilityResult {
    const eligibility = programme.eligibility;
    const preferenceMatch = selectBestPreference(student, programme);

    const criteria = [
      evaluateCourse(preferenceMatch),
      evaluateInstitution(preferenceMatch),
      evaluateAcademic(student, eligibility),
      evaluateQualification(student, eligibility),
      evaluateLocation(student, eligibility),
      evaluateFinancial(student, eligibility),
    ];

    // Year of study is a hard rule with no matching weight, so it is checked here.
    const yearsOfStudy = eligibility?.yearsOfStudy ?? [];
    if (yearsOfStudy.length > 0) {
      if (student.yearOfStudy === null) {
        criteria.push({
          key: 'qualification',
          label: 'Year of study',
          weight: 0,
          status: 'UNKNOWN',
          awarded: 0,
          reason: 'Year of study needs verification',
        });
      } else if (!yearsOfStudy.includes(student.yearOfStudy)) {
        criteria.push({
          key: 'qualification',
          label: 'Year of study',
          weight: 0,
          status: 'NOT_MET',
          awarded: 0,
          reason: 'Year of study not supported',
        });
      } else {
        criteria.push({
          key: 'qualification',
          label: 'Year of study',
          weight: 0,
          status: 'MET',
          awarded: 0,
          reason: 'Year of study requirement met',
        });
      }
    }

    // Citizenship is likewise a gate rather than a weighted criterion.
    const citizenship = eligibility?.citizenship ?? [];
    if (citizenship.length > 0) {
      if (!student.citizenship || student.citizenship === 'PREFER_NOT_TO_SAY') {
        criteria.push({
          key: 'location',
          label: 'Citizenship',
          weight: 0,
          status: 'UNKNOWN',
          awarded: 0,
          reason: 'Citizenship needs verification',
        });
      } else if (!citizenship.includes(student.citizenship)) {
        criteria.push({
          key: 'location',
          label: 'Citizenship',
          weight: 0,
          status: 'NOT_MET',
          awarded: 0,
          reason: 'Citizenship requirement not met',
        });
      } else {
        criteria.push({
          key: 'location',
          label: 'Citizenship',
          weight: 0,
          status: 'MET',
          awarded: 0,
          reason: 'Citizenship requirement met',
        });
      }
    }

    const failed = criteria.filter((c) => c.status === 'NOT_MET');
    const pending = criteria.filter((c) => c.status === 'UNKNOWN');

    const outcome: EligibilityOutcome =
      failed.length > 0 ? 'NOT_ELIGIBLE' : pending.length > 0 ? 'PENDING_VERIFICATION' : 'ELIGIBLE';

    return { outcome, failed, pending, criteria };
  },
};

export const eligibilityOutcomeLabels: Record<EligibilityOutcome, string> = {
  ELIGIBLE: 'Eligible',
  NOT_ELIGIBLE: 'Not eligible',
  PENDING_VERIFICATION: 'Pending verification',
};
