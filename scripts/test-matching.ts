/**
 * Matching-engine checks.
 *
 * Exercises the scoring rules against hand-built profiles so the weights,
 * thresholds and "why this match?" reasons can be verified without a browser.
 * Run with `npm run test:matching`.
 */
import { MatchingService } from '../lib/matching/engine';
import { EligibilityService } from '../lib/matching/eligibility';
import type { MatchableProgramme, MatchableStudent } from '../lib/matching/types';
import { CRITERION_WEIGHTS, UNKNOWN_CREDIT_RATIO } from '../lib/matching/config';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

const CS = 'programme-cs';
const IT = 'programme-it';
const UP = 'institution-up';
const UJ = 'institution-uj';
const WITS = 'institution-wits';

const baseProgramme: MatchableProgramme = {
  id: 'funding-1',
  supportedProgrammeIds: [CS, IT],
  supportedInstitutionIds: [UP, UJ],
  eligibility: {
    minAcademicAverage: 70,
    qualificationLevels: ['BACHELORS'],
    yearsOfStudy: [1, 2, 3],
    citizenship: ['SA_CITIZEN'],
    maxHouseholdIncome: 'R350K_500K',
    requiresFinancialNeed: true,
    provinces: ['GAUTENG'],
    subjectRequirements: [],
  },
};

const perfectStudent: MatchableStudent = {
  studyPreferences: [{ preferenceNumber: 1, programmeId: CS, institutionId: UP }],
  currentProgrammeId: CS,
  currentInstitutionId: UP,
  qualificationLevel: 'BACHELORS',
  academicAverage: 82,
  province: 'GAUTENG',
  householdIncome: 'R100K_200K',
  citizenship: 'SA_CITIZEN',
  yearOfStudy: 2,
  subjectResults: [],
};

console.log('\nMatchingService');

{
  const result = MatchingService.score(perfectStudent, baseProgramme);
  check(
    'a fully qualifying student scores 100',
    result.matchScore === 100,
    `got ${result.matchScore}`,
  );
  check(
    '...and is classified STRONG_MATCH',
    result.classification === 'STRONG_MATCH',
    result.classification,
  );
  // One affirmative reason per criterion. Asserted against the criteria list
  // rather than a literal, so adding a criterion does not break this.
  check(
    '...with an affirmative reason for every criterion',
    result.reasons.length === Object.keys(CRITERION_WEIGHTS).length,
    `got ${result.reasons.length}`,
  );
  check(
    '...including "Course supported"',
    result.reasons.includes('Course supported'),
    result.reasons.join(' | '),
  );
}

{
  // Course and institution must match on the SAME preference.
  const splitStudent: MatchableStudent = {
    ...perfectStudent,
    currentProgrammeId: null,
    currentInstitutionId: null,
    studyPreferences: [
      { preferenceNumber: 1, programmeId: CS, institutionId: WITS },
      { preferenceNumber: 2, programmeId: 'programme-law', institutionId: UP },
    ],
  };
  const result = MatchingService.score(splitStudent, baseProgramme);
  const course = result.criteria.find((c) => c.key === 'course')!;
  const institution = result.criteria.find((c) => c.key === 'institution')!;
  check(
    'a supported course at an unsupported institution does not score both',
    !(course.status === 'MET' && institution.status === 'MET'),
    `course=${course.status} institution=${institution.status}`,
  );
}

{
  const belowAverage: MatchableStudent = { ...perfectStudent, academicAverage: 61 };
  const result = MatchingService.score(belowAverage, baseProgramme);
  const academic = result.criteria.find((c) => c.key === 'academic')!;
  check('an average below the minimum fails the academic criterion', academic.status === 'NOT_MET');
  check(
    '...costing exactly the academic weight',
    result.matchScore === 100 - CRITERION_WEIGHTS.academic,
    `got ${result.matchScore}, expected ${100 - CRITERION_WEIGHTS.academic}`,
  );
  check(
    '...and dropping to POTENTIAL_MATCH',
    result.classification === 'POTENTIAL_MATCH',
    result.classification,
  );
}

{
  const unknownAverage: MatchableStudent = { ...perfectStudent, academicAverage: null };
  const result = MatchingService.score(unknownAverage, baseProgramme);
  const academic = result.criteria.find((c) => c.key === 'academic')!;
  check('a missing average is UNKNOWN, not a failure', academic.status === 'UNKNOWN');
  check(
    '...earning half credit',
    academic.awarded === CRITERION_WEIGHTS.academic * UNKNOWN_CREDIT_RATIO,
    `got ${academic.awarded}`,
  );
  check(
    '...and surfacing a verification message',
    academic.reason.includes('verification'),
    academic.reason,
  );
}

{
  const emptyProfile: MatchableStudent = {
    studyPreferences: [],
    currentProgrammeId: null,
    currentInstitutionId: null,
    qualificationLevel: null,
    academicAverage: null,
    province: null,
    householdIncome: null,
    citizenship: null,
    yearOfStudy: null,
    subjectResults: [],
  };
  const result = MatchingService.score(emptyProfile, baseProgramme);
  check(
    'a student with no preferences is MORE_INFO_NEEDED',
    result.classification === 'MORE_INFO_NEEDED',
    result.classification,
  );
  check('...and is flagged as needing more information', result.needsMoreInformation);
}

{
  const openProgramme: MatchableProgramme = {
    id: 'funding-open',
    supportedProgrammeIds: [],
    supportedInstitutionIds: [],
    eligibility: {
      minAcademicAverage: null,
      qualificationLevels: [],
      yearsOfStudy: [],
      citizenship: [],
      maxHouseholdIncome: null,
      requiresFinancialNeed: false,
      provinces: [],
      subjectRequirements: [],
    },
  };
  const result = MatchingService.score(perfectStudent, openProgramme);
  check(
    'a programme with no restrictions scores 100',
    result.matchScore === 100,
    `got ${result.matchScore}`,
  );
}

{
  const richStudent: MatchableStudent = { ...perfectStudent, householdIncome: 'ABOVE_500K' };
  const result = MatchingService.score(richStudent, baseProgramme);
  const financial = result.criteria.find((c) => c.key === 'financial')!;
  check(
    'income above the funder threshold fails the financial criterion',
    financial.status === 'NOT_MET',
  );
}

{
  const ranked = MatchingService.rank(perfectStudent, [
    {
      ...baseProgramme,
      id: 'weak',
      supportedProgrammeIds: ['other'],
      supportedInstitutionIds: ['other'],
    },
    baseProgramme,
  ]);
  check(
    'rank() returns best-match first',
    ranked[0].programme.id === 'funding-1',
    ranked[0].programme.id,
  );
}

console.log('\nEligibilityService');

{
  const result = EligibilityService.evaluate(perfectStudent, baseProgramme);
  check('a fully qualifying applicant is ELIGIBLE', result.outcome === 'ELIGIBLE', result.outcome);
}

{
  const missingIncome: MatchableStudent = { ...perfectStudent, householdIncome: null };
  const result = EligibilityService.evaluate(missingIncome, baseProgramme);
  check(
    'missing information is PENDING_VERIFICATION, never an automatic rejection',
    result.outcome === 'PENDING_VERIFICATION',
    result.outcome,
  );
  check('...and names the pending criterion', result.pending.length > 0);
}

{
  const wrongYear: MatchableStudent = { ...perfectStudent, yearOfStudy: 5 };
  const result = EligibilityService.evaluate(wrongYear, baseProgramme);
  check(
    'an unsupported year of study is NOT_ELIGIBLE',
    result.outcome === 'NOT_ELIGIBLE',
    result.outcome,
  );
  check(
    '...citing the year-of-study rule',
    result.failed.some((c) => c.label === 'Year of study'),
    result.failed.map((c) => c.label).join(', '),
  );
}

{
  const nonCitizen: MatchableStudent = { ...perfectStudent, citizenship: 'OTHER' };
  const result = EligibilityService.evaluate(nonCitizen, baseProgramme);
  check(
    'a citizenship mismatch is NOT_ELIGIBLE',
    result.outcome === 'NOT_ELIGIBLE',
    result.outcome,
  );
}

// --- subject requirements ---------------------------------------------------
{
  console.log('\nSubject requirements');

  const MATHS = 'subject-maths';
  const SCIENCE = 'subject-science';

  const withRequirements: MatchableProgramme = {
    ...baseProgramme,
    eligibility: {
      ...baseProgramme.eligibility!,
      subjectRequirements: [
        { subjectId: MATHS, subjectName: 'Mathematics', minimumPercentage: 70 },
      ],
    },
  };

  const meets: MatchableStudent = {
    ...perfectStudent,
    subjectResults: [{ subjectId: MATHS, subjectName: 'Mathematics', percentage: 78, year: 2026 }],
  };
  const metResult = MatchingService.score(meets, withRequirements);
  const met = metResult.criteria.find((c) => c.key === 'subjects')!;
  check('a mark above the minimum meets the requirement', met.status === 'MET');
  check(
    '...and the explanation states both numbers',
    met.reason ===
      "Your Mathematics result of 78% meets the bursary's minimum Mathematics requirement of 70%",
    met.reason,
  );

  const below: MatchableStudent = {
    ...perfectStudent,
    subjectResults: [{ subjectId: MATHS, subjectName: 'Mathematics', percentage: 61, year: 2026 }],
  };
  const belowResult = MatchingService.score(below, withRequirements);
  const notMet = belowResult.criteria.find((c) => c.key === 'subjects')!;
  check('a mark below the minimum does not meet it', notMet.status === 'NOT_MET');
  check('...and says so with both numbers', /61%.*70%/.test(notMet.reason), notMet.reason);
  check(
    '...costing exactly the subjects weight',
    belowResult.matchScore === 100 - CRITERION_WEIGHTS.subjects,
    `got ${belowResult.matchScore}`,
  );

  // The rule that matters most: nothing is claimed about a mark nobody has.
  const missing = MatchingService.score(
    { ...perfectStudent, subjectResults: [] },
    withRequirements,
  );
  const unknown = missing.criteria.find((c) => c.key === 'subjects')!;
  check(
    'a subject the student has not entered is UNKNOWN, not a failure',
    unknown.status === 'UNKNOWN',
  );
  check(
    '...and asks for the result rather than judging it',
    /add your mathematics result/i.test(unknown.reason),
    unknown.reason,
  );

  const noMark = MatchingService.score(
    {
      ...perfectStudent,
      subjectResults: [
        { subjectId: MATHS, subjectName: 'Mathematics', percentage: null, year: 2026 },
      ],
    },
    withRequirements,
  );
  check(
    'a subject entered without a mark is UNKNOWN, not a zero',
    noMark.criteria.find((c) => c.key === 'subjects')!.status === 'UNKNOWN',
  );

  // The most recent year wins, so a re-sit supersedes the earlier attempt.
  const resat = MatchingService.score(
    {
      ...perfectStudent,
      subjectResults: [
        { subjectId: MATHS, subjectName: 'Mathematics', percentage: 55, year: 2025 },
        { subjectId: MATHS, subjectName: 'Mathematics', percentage: 74, year: 2026 },
      ],
    },
    withRequirements,
  );
  check(
    'the most recent year supersedes an earlier attempt',
    resat.criteria.find((c) => c.key === 'subjects')!.status === 'MET',
  );

  // A definite failure is decisive even when another requirement passed.
  const twoRequirements: MatchableProgramme = {
    ...baseProgramme,
    eligibility: {
      ...baseProgramme.eligibility!,
      subjectRequirements: [
        { subjectId: MATHS, subjectName: 'Mathematics', minimumPercentage: 70 },
        { subjectId: SCIENCE, subjectName: 'Physical Sciences', minimumPercentage: 65 },
      ],
    },
  };
  const mixed = MatchingService.score(
    {
      ...perfectStudent,
      subjectResults: [
        { subjectId: MATHS, subjectName: 'Mathematics', percentage: 78, year: 2026 },
        { subjectId: SCIENCE, subjectName: 'Physical Sciences', percentage: 50, year: 2026 },
      ],
    },
    twoRequirements,
  );
  check(
    'one failed requirement is decisive',
    mixed.criteria.find((c) => c.key === 'subjects')!.status === 'NOT_MET',
  );

  const partial = MatchingService.score(
    {
      ...perfectStudent,
      subjectResults: [
        { subjectId: MATHS, subjectName: 'Mathematics', percentage: 78, year: 2026 },
      ],
    },
    twoRequirements,
  );
  const partialSubjects = partial.criteria.find((c) => c.key === 'subjects')!;
  check('a partially-known set is UNKNOWN', partialSubjects.status === 'UNKNOWN');
  check(
    '...and still credits what was met',
    /meets the bursary/.test(partialSubjects.reason) &&
      /Physical Sciences/.test(partialSubjects.reason),
    partialSubjects.reason,
  );

  const none = MatchingService.score(perfectStudent, baseProgramme);
  check(
    'a bursary with no subject requirements passes the criterion',
    none.criteria.find((c) => c.key === 'subjects')!.status === 'MET',
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
