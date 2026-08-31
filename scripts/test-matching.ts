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
};

console.log('\nMatchingService');

{
  const result = MatchingService.score(perfectStudent, baseProgramme);
  check('a fully qualifying student scores 100', result.matchScore === 100, `got ${result.matchScore}`);
  check('...and is classified STRONG_MATCH', result.classification === 'STRONG_MATCH', result.classification);
  check('...with six affirmative reasons', result.reasons.length === 6, `got ${result.reasons.length}`);
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
  check('...costing exactly the 20-point academic weight', result.matchScore === 80, `got ${result.matchScore}`);
  check('...and dropping to POTENTIAL_MATCH', result.classification === 'POTENTIAL_MATCH', result.classification);
}

{
  const unknownAverage: MatchableStudent = { ...perfectStudent, academicAverage: null };
  const result = MatchingService.score(unknownAverage, baseProgramme);
  const academic = result.criteria.find((c) => c.key === 'academic')!;
  check('a missing average is UNKNOWN, not a failure', academic.status === 'UNKNOWN');
  check('...earning half credit', academic.awarded === 10, `got ${academic.awarded}`);
  check('...and surfacing a verification message', academic.reason.includes('verification'), academic.reason);
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
    },
  };
  const result = MatchingService.score(perfectStudent, openProgramme);
  check('a programme with no restrictions scores 100', result.matchScore === 100, `got ${result.matchScore}`);
}

{
  const richStudent: MatchableStudent = { ...perfectStudent, householdIncome: 'ABOVE_500K' };
  const result = MatchingService.score(richStudent, baseProgramme);
  const financial = result.criteria.find((c) => c.key === 'financial')!;
  check('income above the funder threshold fails the financial criterion', financial.status === 'NOT_MET');
}

{
  const ranked = MatchingService.rank(perfectStudent, [
    { ...baseProgramme, id: 'weak', supportedProgrammeIds: ['other'], supportedInstitutionIds: ['other'] },
    baseProgramme,
  ]);
  check('rank() returns best-match first', ranked[0].programme.id === 'funding-1', ranked[0].programme.id);
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
  check('an unsupported year of study is NOT_ELIGIBLE', result.outcome === 'NOT_ELIGIBLE', result.outcome);
  check(
    '...citing the year-of-study rule',
    result.failed.some((c) => c.label === 'Year of study'),
    result.failed.map((c) => c.label).join(', '),
  );
}

{
  const nonCitizen: MatchableStudent = { ...perfectStudent, citizenship: 'OTHER' };
  const result = EligibilityService.evaluate(nonCitizen, baseProgramme);
  check('a citizenship mismatch is NOT_ELIGIBLE', result.outcome === 'NOT_ELIGIBLE', result.outcome);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
