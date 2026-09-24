import type { Citizenship, IncomeBand, Province, QualificationLevel } from '@prisma/client';
import { canonicalise } from '@/lib/catalogue';
import {
  citizenshipLabels,
  incomeBandLabels,
  provinceLabels,
  qualificationLabels,
} from '@/lib/labels';
import type { CanonicalKey, StudentProfileData } from '@/lib/pdf/profile';

/**
 * Turning what was read off a form into an applicant record.
 *
 * The extractor gives back strings: whatever the form said, normalised a
 * little. This turns those into the typed fields the application table filters
 * and sorts on — a province, a qualification level, an institution in the
 * catalogue.
 *
 * Every conversion here can fail, and failing is the expected case rather than
 * an error. A form that writes "Gauteng Province" becomes GAUTENG; one that
 * writes "GP" does not, and the field stays null. Null means the reviewer is
 * shown the raw text and asked; a wrong enum means a funder filters an
 * applicant out of their own shortlist without ever knowing it happened.
 */

export type CatalogueIndex = {
  institutions: Map<string, string>;
  programmes: Map<string, string>;
};

/** Match a written value against a label set, exactly or as a clear prefix. */
function fromLabels<T extends string>(
  value: string | undefined,
  labels: Record<T, string>,
): T | null {
  if (!value) return null;
  const needle = value.trim().toLowerCase();
  if (needle.length < 2) return null;

  const entries = Object.entries(labels) as [T, string][];

  for (const [key, label] of entries) {
    if (label.toLowerCase() === needle) return key;
  }
  // "Gauteng Province" for "Gauteng", or "Bachelor's Degree (BSc)" for
  // "Bachelor's Degree". Only when exactly one label is a prefix of the value,
  // so an ambiguous string resolves to nothing rather than to the first hit.
  const prefixed = entries.filter(([, label]) => needle.startsWith(label.toLowerCase()));
  if (prefixed.length === 1) return prefixed[0][0];

  const contained = entries.filter(([, label]) => needle.includes(label.toLowerCase()));
  return contained.length === 1 ? contained[0][0] : null;
}

/** A whole percentage, or null. Never rounded up from a fraction. */
function toPercentage(value: string | undefined): number | null {
  if (!value) return null;
  const match = /(\d{1,3})(?:[.,](\d+))?/.exec(value);
  if (!match) return null;
  const whole = Number(match[1]);
  if (!Number.isFinite(whole) || whole < 0 || whole > 100) return null;
  return whole;
}

function toYear(value: string | undefined): number | null {
  if (!value) return null;
  const match = /(\d)/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1 && year <= 8 ? year : null;
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  // The extractor emits ISO for anything it recognised as a date; anything
  // else is left alone rather than being parsed speculatively here.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type ProjectedApplicant = {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  idNumber: string | null;
  dateOfBirth: Date | null;
  citizenship: Citizenship | null;
  province: Province | null;
  city: string | null;
  institutionName: string | null;
  institutionId: string | null;
  programmeName: string | null;
  programmeId: string | null;
  qualificationLevel: QualificationLevel | null;
  yearOfStudy: number | null;
  academicAverage: number | null;
  householdIncome: IncomeBand | null;
};

export function projectApplicant(
  profile: StudentProfileData,
  catalogue: CatalogueIndex,
): ProjectedApplicant {
  const get = (key: CanonicalKey): string | undefined => profile.values[key]?.value;

  const first = get('firstName')?.trim() || null;
  const last = get('lastName')?.trim() || null;
  const stated = get('fullName')?.trim() || null;

  // A form that gives both halves is preferred to one that gives a single
  // field, because splitting a name is where initials and double surnames go
  // wrong.
  const fullName = first && last ? `${first} ${last}` : (stated ?? first ?? last ?? '');

  const institutionName = get('institution')?.trim() || null;
  const programmeName = get('programme')?.trim() || null;

  return {
    fullName,
    firstName: first,
    lastName: last,
    email: get('email')?.trim().toLowerCase() || null,
    mobile: get('mobile')?.trim() || null,
    idNumber: get('idNumber')?.replace(/\s+/g, '') || null,
    dateOfBirth: toDate(get('dateOfBirth')),
    citizenship: fromLabels(get('citizenship'), citizenshipLabels),
    province: fromLabels(get('province'), provinceLabels),
    city: get('city')?.trim() || null,
    institutionName,
    // The catalogue is what matching scores against, so an institution that is
    // not in it contributes its name to the record and nothing to the score,
    // rather than being invented into the catalogue on an applicant's say-so.
    institutionId: institutionName
      ? (catalogue.institutions.get(canonicalise(institutionName)) ?? null)
      : null,
    programmeName,
    programmeId: programmeName
      ? (catalogue.programmes.get(canonicalise(programmeName)) ?? null)
      : null,
    qualificationLevel: fromLabels(get('qualificationLevel'), qualificationLabels),
    yearOfStudy: toYear(get('yearOfStudy')),
    academicAverage: toPercentage(get('academicAverage')),
    householdIncome: fromLabels(get('householdIncome'), incomeBandLabels),
  };
}

/**
 * Whether this application can be imported without somebody looking at it.
 *
 * A name is the one thing an application cannot be without: a record in a
 * funder's pipeline that does not say whose it is helps nobody. Everything
 * else being missing is a reason to flag, not to refuse — a funder may well
 * want an applicant whose form was half filled in, and it is their call.
 */
export function reviewReasons(
  applicant: ProjectedApplicant,
  profile: StudentProfileData,
): string[] {
  const reasons: string[] = [];

  if (!applicant.fullName.trim()) reasons.push('No applicant name could be read from this form.');
  if (!applicant.email && !applicant.mobile) {
    reasons.push('No email address or phone number was found, so the applicant cannot be reached.');
  }
  if (!applicant.institutionName) reasons.push('No institution was found.');
  if (!applicant.programmeName) reasons.push('No course or qualification was found.');

  const lowConfidence = Object.values(profile.values).filter(
    (value) => value && value.confidence === 'LOW',
  );
  if (lowConfidence.length > 0) {
    reasons.push(
      `${lowConfidence.length} field${lowConfidence.length === 1 ? ' was' : 's were'} read with low confidence and should be checked.`,
    );
  }

  return reasons;
}
