/**
 * The canonical shape of a student's application information.
 *
 * Extraction writes into this; mapping reads out of it. Keeping a single
 * normalised representation in the middle is what lets one source form feed
 * target forms that ask for the same thing in different words.
 *
 * Pure: no Prisma, no React, no I/O — so it can be tested on its own.
 */

/** Every canonical field the engine understands. */
export type CanonicalKey =
  // Personal
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'initials'
  | 'dateOfBirth'
  | 'idNumber'
  | 'gender'
  | 'citizenship'
  | 'race'
  | 'disability'
  // Contact
  | 'email'
  | 'mobile'
  | 'alternatePhone'
  | 'addressLine'
  | 'city'
  | 'province'
  | 'postalCode'
  // Education
  | 'institution'
  | 'programme'
  | 'qualificationLevel'
  | 'yearOfStudy'
  | 'studentNumber'
  | 'academicAverage'
  | 'matricYear'
  // Funding
  | 'fundingNeeded'
  | 'currentFunding'
  | 'householdIncome'
  // Free text
  | 'achievements'
  | 'careerInterests'
  | 'motivation';

export type ValueKind = 'text' | 'number' | 'date' | 'boolean' | 'choice';

/**
 * One piece of information, with where it came from.
 *
 * `provenance` is what makes §34 traceability possible: every populated target
 * field can name the source document, page and field its value came from.
 */
export type CanonicalValue = {
  key: CanonicalKey;
  kind: ValueKind;
  /** Normalised value, e.g. an ISO date or a digits-only phone number. */
  value: string;
  /** What the source literally said, kept for display and audit. */
  raw: string;
  confidence: Confidence;
  provenance: {
    documentName: string;
    page: number | null;
    fieldLabel: string;
    /** How the value was obtained. */
    method: 'acroform' | 'text-layout';
  };
};

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type StudentProfileData = {
  values: Partial<Record<CanonicalKey, CanonicalValue>>;
  /** Labels seen on the source form that mapped to nothing. */
  unmapped: { label: string; value: string; page: number | null }[];
};

export const CANONICAL_KINDS: Record<CanonicalKey, ValueKind> = {
  firstName: 'text',
  lastName: 'text',
  fullName: 'text',
  initials: 'text',
  dateOfBirth: 'date',
  idNumber: 'text',
  gender: 'choice',
  citizenship: 'choice',
  race: 'choice',
  disability: 'boolean',
  email: 'text',
  mobile: 'text',
  alternatePhone: 'text',
  addressLine: 'text',
  city: 'text',
  province: 'choice',
  postalCode: 'text',
  institution: 'text',
  programme: 'text',
  qualificationLevel: 'choice',
  yearOfStudy: 'number',
  studentNumber: 'text',
  academicAverage: 'number',
  matricYear: 'number',
  fundingNeeded: 'text',
  currentFunding: 'text',
  householdIncome: 'text',
  achievements: 'text',
  careerInterests: 'text',
  motivation: 'text',
};

/** Human labels, used in the review panel. */
export const CANONICAL_LABELS: Record<CanonicalKey, string> = {
  firstName: 'First name',
  lastName: 'Surname',
  fullName: 'Full name',
  initials: 'Initials',
  dateOfBirth: 'Date of birth',
  idNumber: 'ID number',
  gender: 'Gender',
  citizenship: 'Citizenship',
  race: 'Population group',
  disability: 'Disability',
  email: 'Email address',
  mobile: 'Mobile number',
  alternatePhone: 'Alternative phone',
  addressLine: 'Street address',
  city: 'City or town',
  province: 'Province',
  postalCode: 'Postal code',
  institution: 'Institution',
  programme: 'Course or programme',
  qualificationLevel: 'Qualification level',
  yearOfStudy: 'Year of study',
  studentNumber: 'Student number',
  academicAverage: 'Academic average',
  matricYear: 'Matric year',
  fundingNeeded: 'Funding needed',
  currentFunding: 'Current funding',
  householdIncome: 'Household income',
  achievements: 'Achievements',
  careerInterests: 'Career interests',
  motivation: 'Motivation',
};
