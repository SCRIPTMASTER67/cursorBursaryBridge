import type {
  Achievement,
  Citizenship,
  FundingNeed,
  FundingSituation,
  IncomeBand,
  Province,
  QualificationLevel,
  TriState,
} from '@prisma/client';

/**
 * One shape for an applicant, whoever they are.
 *
 * An application now has two possible people behind it: a student with a
 * Bursary-Bridge account, and somebody who applied to the organisation by
 * email and was imported. A reviewer should not have to care which — the same
 * table, the same detail page, the same scoring — so everything corporate-side
 * reads this projection instead of reaching into one relation or the other.
 *
 * Where an imported applicant genuinely has less information (nobody asked
 * them about their achievements on a PDF form), the field is empty rather than
 * filled with a plausible default. An empty field says "not known"; a default
 * would say something false about a real person to a funder deciding whether
 * to fund them.
 */

export type ApplicantView = {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  province: Province | null;
  city: string | null;
  institution: string | null;
  programme: string | null;
  qualificationLevel: QualificationLevel | null;
  yearOfStudy: number | null;
  academicAverage: number | null;
  householdIncome: IncomeBand | null;
  citizenship: Citizenship | null;
  achievements: Achievement[];
  fundingNeeds: FundingNeed[];
  fundingSituation: FundingSituation | null;
  firstGeneration: TriState | null;
  studyPreferences: { preferenceNumber: number; programme: string; institution: string }[];
  /** True when this applicant has no account here. */
  external: boolean;
  /** Set only for an imported applicant, and only when the form stated it. */
  idNumber: string | null;
};

type StudentSide = {
  province: Province | null;
  city: string | null;
  qualificationLevel: QualificationLevel | null;
  yearOfStudy: number | null;
  academicAverage: number | null;
  achievements: Achievement[];
  householdIncome: IncomeBand | null;
  citizenship: Citizenship | null;
  firstGeneration: TriState | null;
  fundingNeeds: FundingNeed[];
  fundingSituation: FundingSituation | null;
  user: { firstName: string; lastName: string; email: string; mobile: string | null };
  currentInstitution: { name: string } | null;
  currentProgramme: { name: string } | null;
  studyPreferences: {
    preferenceNumber: number;
    programme: { name: string };
    institution: { name: string };
  }[];
};

type ExternalSide = {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  idNumber: string | null;
  citizenship: Citizenship | null;
  province: Province | null;
  city: string | null;
  institutionName: string | null;
  programmeName: string | null;
  qualificationLevel: QualificationLevel | null;
  yearOfStudy: number | null;
  academicAverage: number | null;
  householdIncome: IncomeBand | null;
};

/** Split a single name field into two, without inventing either half. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function applicantView(application: {
  studentProfile: StudentSide | null;
  externalApplicant: ExternalSide | null;
}): ApplicantView {
  const student = application.studentProfile;
  if (student) {
    return {
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      fullName: `${student.user.firstName} ${student.user.lastName}`.trim(),
      email: student.user.email,
      mobile: student.user.mobile,
      province: student.province,
      city: student.city,
      institution: student.currentInstitution?.name ?? null,
      programme: student.currentProgramme?.name ?? null,
      qualificationLevel: student.qualificationLevel,
      yearOfStudy: student.yearOfStudy,
      academicAverage: student.academicAverage,
      householdIncome: student.householdIncome,
      citizenship: student.citizenship,
      achievements: student.achievements,
      fundingNeeds: student.fundingNeeds,
      fundingSituation: student.fundingSituation,
      firstGeneration: student.firstGeneration,
      studyPreferences: student.studyPreferences.map((preference) => ({
        preferenceNumber: preference.preferenceNumber,
        programme: preference.programme.name,
        institution: preference.institution.name,
      })),
      external: false,
      // A platform student's identity number is not held on their profile, so
      // there is nothing to show here rather than something to hide.
      idNumber: null,
    };
  }

  const applicant = application.externalApplicant;
  if (applicant) {
    const split = splitName(applicant.fullName);
    return {
      firstName: applicant.firstName ?? split.firstName,
      lastName: applicant.lastName ?? split.lastName,
      fullName: applicant.fullName,
      email: applicant.email,
      mobile: applicant.mobile,
      province: applicant.province,
      city: applicant.city,
      institution: applicant.institutionName,
      programme: applicant.programmeName,
      qualificationLevel: applicant.qualificationLevel,
      yearOfStudy: applicant.yearOfStudy,
      academicAverage: applicant.academicAverage,
      householdIncome: applicant.householdIncome,
      citizenship: applicant.citizenship,
      // A PDF application form does not ask these, so they stay empty.
      achievements: [],
      fundingNeeds: [],
      fundingSituation: null,
      firstGeneration: null,
      studyPreferences: [],
      external: true,
      idNumber: applicant.idNumber,
    };
  }

  // An application with neither side is a data fault, not a person with no
  // name. It is rendered as unknown rather than crashing a reviewer's page.
  return {
    firstName: '',
    lastName: '',
    fullName: 'Unknown applicant',
    email: null,
    mobile: null,
    province: null,
    city: null,
    institution: null,
    programme: null,
    qualificationLevel: null,
    yearOfStudy: null,
    academicAverage: null,
    householdIncome: null,
    citizenship: null,
    achievements: [],
    fundingNeeds: [],
    fundingSituation: null,
    firstGeneration: null,
    studyPreferences: [],
    external: true,
    idNumber: null,
  };
}

/** The relation selection every corporate read needs to build the view. */
export const APPLICANT_INCLUDE = {
  studentProfile: {
    include: {
      user: { select: { firstName: true, lastName: true, email: true, mobile: true } },
      currentInstitution: { select: { name: true } },
      currentProgramme: { select: { name: true } },
      studyPreferences: {
        orderBy: { preferenceNumber: 'asc' },
        include: {
          programme: { select: { name: true } },
          institution: { select: { name: true } },
        },
      },
    },
  },
  externalApplicant: true,
} as const;

/**
 * The compact version, for tables and lists.
 *
 * Deliberately separate from `applicantView`: a list query selects six columns
 * for a thousand rows, and making it load a full profile to render a name
 * would be the kind of convenience that costs a page two seconds.
 */
export type ApplicantSummary = {
  fullName: string;
  email: string | null;
  institution: string | null;
  programme: string | null;
  qualificationLevel: QualificationLevel | null;
  academicAverage: number | null;
  external: boolean;
};

export function applicantSummary(application: {
  studentProfile: {
    academicAverage: number | null;
    qualificationLevel: QualificationLevel | null;
    user: { firstName: string; lastName: string; email: string };
    currentInstitution: { name: string; shortName?: string | null } | null;
    currentProgramme: { name: string } | null;
  } | null;
  externalApplicant: {
    fullName: string;
    email: string | null;
    institutionName: string | null;
    programmeName: string | null;
    qualificationLevel: QualificationLevel | null;
    academicAverage: number | null;
  } | null;
}): ApplicantSummary {
  const student = application.studentProfile;
  if (student) {
    return {
      fullName: `${student.user.firstName} ${student.user.lastName}`.trim(),
      email: student.user.email,
      institution:
        student.currentInstitution?.name ?? student.currentInstitution?.shortName ?? null,
      programme: student.currentProgramme?.name ?? null,
      qualificationLevel: student.qualificationLevel,
      academicAverage: student.academicAverage,
      external: false,
    };
  }

  const applicant = application.externalApplicant;
  return {
    fullName: applicant?.fullName ?? 'Unknown applicant',
    email: applicant?.email ?? null,
    institution: applicant?.institutionName ?? null,
    programme: applicant?.programmeName ?? null,
    qualificationLevel: applicant?.qualificationLevel ?? null,
    academicAverage: applicant?.academicAverage ?? null,
    external: true,
  };
}
