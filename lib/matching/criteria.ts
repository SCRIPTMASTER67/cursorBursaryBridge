import { incomeBandOrder } from '@/lib/labels';
import { CRITERION_LABELS, CRITERION_WEIGHTS, UNKNOWN_CREDIT_RATIO } from './config';
import type {
  CriterionKey,
  CriterionResult,
  CriterionStatus,
  MatchableEligibility,
  MatchablePreference,
  MatchableProgramme,
  MatchableStudent,
} from './types';

function build(
  key: CriterionKey,
  status: CriterionStatus,
  reason: string,
): CriterionResult {
  const weight = CRITERION_WEIGHTS[key];
  const awarded =
    status === 'MET' ? weight : status === 'UNKNOWN' ? weight * UNKNOWN_CREDIT_RATIO : 0;
  return { key, label: CRITERION_LABELS[key], weight, status, awarded, reason };
}

/**
 * The preference the student is judged on.
 *
 * A student who wants Computer Science at UP is not a match for a bursary that
 * funds Computer Science at UJ, so course and institution are scored on the
 * SAME preference — we pick whichever of the student's (up to six) preferences
 * scores best against this programme.
 */
export type PreferenceMatch = {
  preference: MatchablePreference | null;
  courseSupported: boolean;
  institutionSupported: boolean;
  /** True when the student gave us nothing to compare against. */
  unknown: boolean;
};

export function selectBestPreference(
  student: MatchableStudent,
  programme: MatchableProgramme,
): PreferenceMatch {
  const courses = new Set(programme.supportedProgrammeIds);
  const institutions = new Set(programme.supportedInstitutionIds);

  // A programme that names no courses/institutions places no such restriction.
  const courseUnrestricted = courses.size === 0;
  const institutionUnrestricted = institutions.size === 0;

  const candidates: MatchablePreference[] = [...student.studyPreferences];

  // An enrolled student's current registration counts as an implicit preference.
  if (student.currentProgrammeId && student.currentInstitutionId) {
    const alreadyListed = candidates.some(
      (p) =>
        p.programmeId === student.currentProgrammeId &&
        p.institutionId === student.currentInstitutionId,
    );
    if (!alreadyListed) {
      candidates.push({
        preferenceNumber: 0,
        programmeId: student.currentProgrammeId,
        institutionId: student.currentInstitutionId,
      });
    }
  }

  if (candidates.length === 0) {
    return {
      preference: null,
      courseSupported: courseUnrestricted,
      institutionSupported: institutionUnrestricted,
      unknown: true,
    };
  }

  let best: PreferenceMatch = {
    preference: candidates[0],
    courseSupported: false,
    institutionSupported: false,
    unknown: false,
  };
  let bestScore = -1;

  for (const preference of candidates) {
    const courseSupported = courseUnrestricted || courses.has(preference.programmeId);
    const institutionSupported =
      institutionUnrestricted || institutions.has(preference.institutionId);

    const score =
      (courseSupported ? CRITERION_WEIGHTS.course : 0) +
      (institutionSupported ? CRITERION_WEIGHTS.institution : 0) +
      // Break ties in favour of the student's higher-ranked preference.
      (7 - Math.min(preference.preferenceNumber || 7, 7)) * 0.01;

    if (score > bestScore) {
      bestScore = score;
      best = { preference, courseSupported, institutionSupported, unknown: false };
    }
  }

  return best;
}

export function evaluateCourse(match: PreferenceMatch): CriterionResult {
  if (match.unknown && !match.courseSupported) {
    return build('course', 'UNKNOWN', 'Add a study preference so we can check the course');
  }
  return match.courseSupported
    ? build('course', 'MET', 'Course supported')
    : build('course', 'NOT_MET', 'Course not supported by this programme');
}

export function evaluateInstitution(match: PreferenceMatch): CriterionResult {
  if (match.unknown && !match.institutionSupported) {
    return build('institution', 'UNKNOWN', 'Add a study preference so we can check the institution');
  }
  return match.institutionSupported
    ? build('institution', 'MET', 'Institution supported')
    : build('institution', 'NOT_MET', 'Institution not supported by this programme');
}

export function evaluateAcademic(
  student: MatchableStudent,
  eligibility: MatchableEligibility | null,
): CriterionResult {
  const minimum = eligibility?.minAcademicAverage ?? null;
  if (minimum === null) {
    return build('academic', 'MET', 'No minimum average required');
  }
  if (student.academicAverage === null) {
    return build('academic', 'UNKNOWN', `Academic average needs verification (${minimum}% required)`);
  }
  return student.academicAverage >= minimum
    ? build('academic', 'MET', 'Academic requirement met')
    : build(
        'academic',
        'NOT_MET',
        `Academic average below the ${minimum}% required`,
      );
}

export function evaluateQualification(
  student: MatchableStudent,
  eligibility: MatchableEligibility | null,
): CriterionResult {
  const levels = eligibility?.qualificationLevels ?? [];
  if (levels.length === 0) {
    return build('qualification', 'MET', 'Open to all qualification levels');
  }
  if (!student.qualificationLevel) {
    return build('qualification', 'UNKNOWN', 'Tell us your qualification level to confirm this');
  }
  return levels.includes(student.qualificationLevel)
    ? build('qualification', 'MET', 'Qualification level matches')
    : build('qualification', 'NOT_MET', 'Qualification level not supported');
}

export function evaluateLocation(
  student: MatchableStudent,
  eligibility: MatchableEligibility | null,
): CriterionResult {
  const provinces = eligibility?.provinces ?? [];
  if (provinces.length === 0) {
    return build('location', 'MET', 'Open to all provinces');
  }
  if (!student.province) {
    return build('location', 'UNKNOWN', 'Add your province to confirm this requirement');
  }
  return provinces.includes(student.province)
    ? build('location', 'MET', 'Location requirement met')
    : build('location', 'NOT_MET', 'Outside the supported provinces');
}

export function evaluateFinancial(
  student: MatchableStudent,
  eligibility: MatchableEligibility | null,
): CriterionResult {
  const maxBand = eligibility?.maxHouseholdIncome ?? null;
  const requiresNeed = eligibility?.requiresFinancialNeed ?? false;

  if (!maxBand && !requiresNeed) {
    return build('financial', 'MET', 'No financial requirement');
  }

  const studentRank = student.householdIncome ? incomeBandOrder[student.householdIncome] : null;
  if (studentRank === null) {
    return build('financial', 'UNKNOWN', 'Financial requirement needs verification');
  }

  if (maxBand) {
    const maxRank = incomeBandOrder[maxBand];
    if (maxRank === null) {
      return build('financial', 'MET', 'No financial requirement');
    }
    return studentRank <= maxRank
      ? build('financial', 'MET', 'Financial requirement met')
      : build('financial', 'NOT_MET', 'Household income above the funder threshold');
  }

  // requiresFinancialNeed with no explicit band — any declared band qualifies.
  return build('financial', 'MET', 'Financial requirement met');
}
