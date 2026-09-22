import type { CanonicalKey } from './profile';

/**
 * Label vocabulary.
 *
 * Bursary forms ask for the same information in different words, so matching
 * cannot rely on identical field names. Each canonical key carries the phrasings
 * seen in practice; `exact` phrases are unambiguous on their own, `tokens` are
 * weaker signals that only count when combined.
 *
 * This is a deterministic dictionary rather than a language model. That is a
 * deliberate trade: it is inspectable, reproducible and cannot hallucinate a
 * mapping. `MatcherProvider` in match.ts is the seam where a model-backed
 * matcher can be added without the rest of the engine changing.
 */
export type AliasEntry = {
  key: CanonicalKey;
  exact: string[];
  tokens?: string[];
  /** Labels that look similar but mean something else. */
  negative?: string[];
};

export const ALIASES: AliasEntry[] = [
  {
    key: 'firstName',
    // "name" on its own is deliberately absent: on a bursary form it usually
    // means the full name, and writing a first name into a full-name box is a
    // wrong answer. A lone "Name" is left for the student to decide.
    exact: [
      'first name',
      'first names',
      'firstname',
      'given name',
      'given names',
      'forename',
      'forenames',
    ],
    tokens: ['first', 'given', 'forename'],
    // "name of institution" is not the applicant's first name.
    negative: [
      'institution',
      'school',
      'university',
      'college',
      'parent',
      'guardian',
      'employer',
      'bank',
      'next of kin',
      'referee',
    ],
  },
  {
    key: 'lastName',
    exact: [
      'surname',
      'last name',
      'lastname',
      'family name',
      'applicant surname',
      "applicant's surname",
    ],
    tokens: ['surname', 'family'],
    negative: ['parent', 'guardian', 'next of kin', 'referee', 'maiden'],
  },
  {
    key: 'fullName',
    // "names" on its own is absent for the same reason: it appears inside
    // "First Names" and "Other Names", which mean something narrower.
    exact: ['full name', 'full names', 'name in full', 'applicant name', "applicant's full name"],
    negative: [
      'institution',
      'parent',
      'guardian',
      'bank',
      'referee',
      'next of kin',
      'first',
      'given',
      'other',
      'maiden',
    ],
  },
  { key: 'initials', exact: ['initials'] },
  {
    key: 'dateOfBirth',
    exact: ['date of birth', 'dob', 'birth date', 'birthdate', 'applicant date of birth', 'd.o.b'],
    tokens: ['birth'],
  },
  {
    key: 'idNumber',
    exact: [
      'id number',
      'identity number',
      'sa id number',
      'rsa id number',
      'id no',
      'national id',
      'identity document number',
    ],
    tokens: ['identity'],
    negative: ['parent', 'guardian', 'student', 'passport', 'next of kin'],
  },
  { key: 'gender', exact: ['gender', 'sex'] },
  {
    key: 'citizenship',
    exact: [
      'citizenship',
      'nationality',
      'south african citizen',
      'sa citizen',
      'are you a south african citizen',
      'citizen',
    ],
    tokens: ['citizen', 'nationality'],
  },
  { key: 'race', exact: ['race', 'population group', 'ethnic group', 'ethnicity'] },
  {
    key: 'disability',
    exact: ['disability', 'do you have a disability', 'disabled', 'disability status'],
  },
  {
    key: 'email',
    exact: [
      'email',
      'e-mail',
      'e mail',
      'email address',
      'e-mail address',
      'e mail address',
      'electronic mail',
    ],
    tokens: ['email'],
    negative: ['parent', 'guardian', 'referee', 'next of kin'],
  },
  {
    key: 'mobile',
    exact: [
      'mobile',
      'mobile number',
      'cell number',
      'cellphone',
      'cellphone number',
      'cell phone',
      'contact number',
      'applicant contact number',
      'telephone',
      'phone number',
      'contact',
    ],
    tokens: ['mobile', 'cell', 'phone', 'contact number'],
    negative: ['parent', 'guardian', 'referee', 'next of kin', 'alternative', 'work'],
  },
  {
    key: 'alternatePhone',
    exact: [
      'alternative number',
      'alternate number',
      'alternative contact',
      'home telephone',
      'work telephone',
    ],
  },
  {
    key: 'addressLine',
    exact: [
      'address',
      'street address',
      'residential address',
      'physical address',
      'home address',
      'postal address',
    ],
    tokens: ['address'],
    negative: ['email', 'e-mail', 'institution'],
  },
  { key: 'city', exact: ['city', 'town', 'city or town', 'city/town', 'suburb'] },
  { key: 'province', exact: ['province', 'region'] },
  { key: 'postalCode', exact: ['postal code', 'post code', 'zip code', 'postcode'] },
  {
    key: 'institution',
    exact: [
      'institution',
      'university',
      'college',
      'tertiary institution',
      'name of institution',
      'institution currently attending',
      'institution attending',
      'university/college',
      'place of study',
    ],
    tokens: ['institution', 'university', 'college'],
  },
  {
    key: 'programme',
    exact: [
      'course',
      'programme',
      'program',
      'degree',
      'qualification name',
      'field of study',
      'course of study',
      'intended course',
      'study direction',
    ],
    tokens: ['course', 'programme', 'degree', 'field of study'],
  },
  {
    key: 'qualificationLevel',
    exact: [
      'qualification level',
      'level of study',
      'study level',
      'degree level',
      'qualification type',
    ],
  },
  {
    key: 'yearOfStudy',
    exact: [
      'year of study',
      'current year of study',
      'study year',
      'academic year',
      'year of registration',
    ],
    tokens: ['year of study'],
  },
  {
    key: 'studentNumber',
    exact: [
      'student number',
      'student no',
      'student id',
      'registration number',
      'university number',
    ],
    tokens: ['student number'],
  },
  {
    key: 'academicAverage',
    exact: [
      'academic average',
      'average',
      'current average',
      'aggregate',
      'overall average',
      'average percentage',
      'academic result',
    ],
    tokens: ['average', 'aggregate'],
  },
  {
    key: 'matricYear',
    exact: ['matric year', 'year of matric', 'year completed matric', 'grade 12 year'],
  },
  {
    key: 'fundingNeeded',
    exact: [
      'funding required',
      'funding needed',
      'amount required',
      'amount requested',
      'financial assistance required',
    ],
  },
  {
    key: 'currentFunding',
    exact: [
      'current funding',
      'other funding',
      'existing bursary',
      'other bursaries',
      'do you receive funding',
    ],
  },
  {
    key: 'householdIncome',
    exact: [
      'household income',
      'annual household income',
      'combined household income',
      'family income',
      'gross household income',
      'total household income',
    ],
    tokens: ['household income', 'family income'],
  },
  {
    key: 'achievements',
    exact: ['achievements', 'awards', 'accomplishments', 'extracurricular', 'leadership roles'],
  },
  {
    key: 'careerInterests',
    exact: ['career interests', 'career goals', 'career aspirations', 'intended career'],
  },
  {
    key: 'motivation',
    exact: [
      'motivation',
      'motivational statement',
      'why do you deserve this bursary',
      'reason for applying',
      'personal statement',
    ],
    tokens: ['motivation', 'why'],
  },
];

/** Labels that must never be treated as the applicant's own information. */
export const THIRD_PARTY_MARKERS = [
  'parent',
  'guardian',
  'next of kin',
  'referee',
  'reference',
  'employer',
  'spouse',
  'sibling',
  'emergency contact',
  'bank',
  'witness',
];
