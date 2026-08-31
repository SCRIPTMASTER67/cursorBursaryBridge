/**
 * Human-readable labels for every enum in the schema.
 *
 * This is the single source of truth for the copy shown in dropdowns, badges
 * and summary screens. UI components must never hard-code enum wording.
 */
import type {
  Achievement,
  ApplicationStatus,
  ApplicationVolume,
  BursaryStatus,
  CareerInterest,
  Citizenship,
  CorporateRole,
  DocumentType,
  EducationStage,
  FundingCoverage,
  FundingNeed,
  FundingSituation,
  FundingType,
  IncomeBand,
  Industry,
  InstitutionType,
  MatchClassification,
  NotificationType,
  OffersFunding,
  OrganisationSize,
  OrganisationType,
  ProcessChallenge,
  ProcessMethod,
  ProgrammeStatus,
  ProgrammeTypeOffered,
  Province,
  QualificationLevel,
  ResultType,
  ShortlistStatus,
  StudyLocationPreference,
  StudyStatus,
  TriState,
} from '@prisma/client';

export type Option<T extends string> = { value: T; label: string; description?: string };

/** Turn a label map into the `{ value, label }[]` shape our Select expects. */
export function toOptions<T extends string>(map: Record<T, string>): Option<T>[] {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value] }));
}

export const educationStageLabels: Record<EducationStage, string> = {
  GRADE_10: 'Grade 10',
  GRADE_11: 'Grade 11',
  MATRIC: 'Matric / Grade 12',
  UNIVERSITY_FIRST_YEAR: 'University / College — First Year',
  UNIVERSITY_CURRENT: 'University / College — Current Student',
  TVET_COLLEGE: 'TVET College',
  POSTGRADUATE: 'Postgraduate',
  PLANNING_TO_STUDY: 'Planning to study',
  OTHER: 'Other',
};

/** Stages where asking about a tertiary qualification would make no sense. */
export const schoolStages: EducationStage[] = ['GRADE_10', 'GRADE_11'];

export const qualificationLabels: Record<QualificationLevel, string> = {
  CERTIFICATE: 'Certificate',
  DIPLOMA: 'Diploma',
  ADVANCED_DIPLOMA: 'Advanced Diploma',
  BACHELORS: "Bachelor's Degree",
  HONOURS: 'Honours Degree',
  MASTERS: "Master's Degree",
  DOCTORAL: 'Doctoral Degree',
  OTHER: 'Other',
};

export const studyStatusLabels: Record<StudyStatus, string> = {
  CURRENTLY_ENROLLED: 'Currently enrolled',
  ACCEPTED_NOT_REGISTERED: 'Accepted but not yet registered',
  APPLIED_AWAITING: 'Applied and awaiting acceptance',
  PLANNING_TO_APPLY: 'Planning to apply',
  RETURNING_STUDENT: 'Returning student',
  OTHER: 'Other',
};

export const resultTypeLabels: Record<ResultType, string> = {
  SCHOOL_REPORT: 'School report',
  MATRIC_RESULTS: 'Matric results',
  UNIVERSITY_TRANSCRIPT: 'University transcript',
  ACADEMIC_RECORD: 'Academic record',
  OTHER: 'Other',
  NONE_YET: "I don't have results yet",
};

export const achievementLabels: Record<Achievement, string> = {
  SUBJECT_DISTINCTIONS: 'Subject distinctions',
  ACADEMIC_AWARDS: 'Academic awards',
  DEANS_LIST: "Dean's list",
  COMPETITIONS: 'Academic competitions',
  OLYMPIADS: 'Olympiads',
  RESEARCH: 'Research achievements',
  OTHER: 'Other',
  NONE: 'None',
};

export const fundingNeedLabels: Record<FundingNeed, string> = {
  TUITION_FEES: 'Tuition fees',
  REGISTRATION_FEES: 'Registration fees',
  ACCOMMODATION: 'Accommodation',
  BOOKS_MATERIALS: 'Books / study materials',
  MEALS_LIVING: 'Meals / living allowance',
  TRANSPORT: 'Transport',
  LAPTOP_DEVICE: 'Laptop / device',
  OTHER_EXPENSES: 'Other expenses',
  FULL_FUNDING: 'Full funding',
  PARTIAL_FUNDING: 'Partial funding',
  NOT_SURE: "I'm not sure",
};

export const fundingSituationLabels: Record<FundingSituation, string> = {
  NO_FUNDING: 'I currently have no funding',
  PARTIALLY_FUNDED: 'I am partially funded',
  FULLY_FUNDED: 'I am fully funded',
  AWAITING_DECISION: 'I have applied and am waiting for a decision',
  DONT_KNOW: "I don't know",
};

export const bursaryStatusLabels: Record<BursaryStatus, string> = {
  YES: 'Yes',
  NO: 'No',
  APPLICATION_PENDING: 'Application pending',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

export const incomeBandLabels: Record<IncomeBand, string> = {
  BELOW_50K: 'Below R50,000',
  R50K_100K: 'R50,000 – R100,000',
  R100K_200K: 'R100,001 – R200,000',
  R200K_350K: 'R200,001 – R350,000',
  R350K_500K: 'R350,001 – R500,000',
  ABOVE_500K: 'Above R500,000',
  DONT_KNOW: "I don't know",
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

/**
 * Ordering used when comparing a student's income band against a funder's
 * maximum. Bands that carry no financial signal are deliberately excluded.
 */
export const incomeBandOrder: Record<IncomeBand, number | null> = {
  BELOW_50K: 1,
  R50K_100K: 2,
  R100K_200K: 3,
  R200K_350K: 4,
  R350K_500K: 5,
  ABOVE_500K: 6,
  DONT_KNOW: null,
  PREFER_NOT_TO_SAY: null,
};

export const citizenshipLabels: Record<Citizenship, string> = {
  SA_CITIZEN: 'South African citizen',
  PERMANENT_RESIDENT: 'Permanent resident',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

export const triStateLabels: Record<TriState, string> = {
  YES: 'Yes',
  NO: 'No',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

export const studyLocationLabels: Record<StudyLocationPreference, string> = {
  SAME_LOCATION: 'Same location',
  DIFFERENT_LOCATION: 'Different location',
  NOT_SURE: 'Not sure',
};

export const careerInterestLabels: Record<CareerInterest, string> = {
  TECHNOLOGY: 'Technology',
  ENGINEERING: 'Engineering',
  HEALTHCARE: 'Healthcare',
  FINANCE_ACCOUNTING: 'Finance & Accounting',
  LAW: 'Law',
  EDUCATION: 'Education',
  AGRICULTURE: 'Agriculture',
  SCIENCE_RESEARCH: 'Science & Research',
  BUSINESS: 'Business',
  GOVERNMENT: 'Government',
  MINING: 'Mining',
  ENERGY: 'Energy',
  MANUFACTURING: 'Manufacturing',
  CONSTRUCTION: 'Construction',
  MEDIA_COMMUNICATIONS: 'Media & Communications',
  OTHER: 'Other',
};

export const provinceLabels: Record<Province, string> = {
  EASTERN_CAPE: 'Eastern Cape',
  FREE_STATE: 'Free State',
  GAUTENG: 'Gauteng',
  KWAZULU_NATAL: 'KwaZulu-Natal',
  LIMPOPO: 'Limpopo',
  MPUMALANGA: 'Mpumalanga',
  NORTHERN_CAPE: 'Northern Cape',
  NORTH_WEST: 'North West',
  WESTERN_CAPE: 'Western Cape',
};

export const institutionTypeLabels: Record<InstitutionType, string> = {
  UNIVERSITY: 'University',
  UNIVERSITY_OF_TECHNOLOGY: 'University of Technology',
  TVET_COLLEGE: 'TVET College',
  PRIVATE_INSTITUTION: 'Private Institution',
  OTHER: 'Other',
};

export const organisationTypeLabels: Record<OrganisationType, string> = {
  CORPORATION: 'Corporation',
  FOUNDATION: 'Foundation',
  NGO: 'NGO',
  NON_PROFIT: 'Non-profit organisation',
  PROFESSIONAL_ORGANISATION: 'Professional organisation',
  GOVERNMENT_ORGANISATION: 'Government organisation',
  EDUCATIONAL_ORGANISATION: 'Educational organisation',
  OTHER: 'Other',
};

export const industryLabels: Record<Industry, string> = {
  FINANCIAL_SERVICES: 'Financial Services',
  MINING: 'Mining',
  TECHNOLOGY: 'Technology',
  TELECOMMUNICATIONS: 'Telecommunications',
  ENGINEERING: 'Engineering',
  HEALTHCARE: 'Healthcare',
  ENERGY: 'Energy',
  MANUFACTURING: 'Manufacturing',
  RETAIL: 'Retail',
  CONSTRUCTION: 'Construction',
  PROFESSIONAL_SERVICES: 'Professional Services',
  OTHER: 'Other',
};

export const corporateRoleLabels: Record<CorporateRole, string> = {
  BURSARY_FUNDING_MANAGER: 'Bursary / Funding Manager',
  HR_MANAGER: 'HR Manager',
  TALENT_MANAGER: 'Talent Manager',
  CSI_MANAGER: 'Corporate Social Investment Manager',
  FOUNDATION_MANAGER: 'Foundation Manager',
  PROGRAMME_MANAGER: 'Programme Manager',
  ADMINISTRATOR: 'Administrator',
  EXECUTIVE: 'Executive',
  OTHER: 'Other',
};

export const organisationSizeLabels: Record<OrganisationSize, string> = {
  UNDER_50: 'Under 50 employees',
  SIZE_50_250: '50 – 250 employees',
  SIZE_251_1000: '251 – 1,000 employees',
  SIZE_1001_5000: '1,001 – 5,000 employees',
  ABOVE_5000: 'More than 5,000 employees',
};

export const programmeTypeOfferedLabels: Record<ProgrammeTypeOffered, string> = {
  BURSARIES: 'Bursaries',
  SCHOLARSHIPS: 'Scholarships',
  GRANTS: 'Grants',
  INTERNSHIPS: 'Internships',
  LEARNERSHIPS: 'Learnerships',
  GRADUATE_PROGRAMMES: 'Graduate programmes',
  OTHER: 'Other',
};

export const offersFundingLabels: Record<OffersFunding, string> = {
  YES: 'Yes',
  NO: 'No',
  PLANNING_TO: 'Planning to',
  NOT_SURE: 'Not sure',
};

export const applicationVolumeLabels: Record<ApplicationVolume, string> = {
  UNDER_100: 'Under 100',
  V100_500: '100 – 500',
  V501_1000: '501 – 1,000',
  V1001_5000: '1,001 – 5,000',
  V5001_10000: '5,001 – 10,000',
  ABOVE_10000: '10,000+',
};

export const processMethodLabels: Record<ProcessMethod, string> = {
  EMAIL: 'Email',
  SPREADSHEETS: 'Excel / Spreadsheets',
  GOOGLE_FORMS: 'Google Forms',
  WEBSITE_FORMS: 'Website forms',
  DEDICATED_SOFTWARE: 'Dedicated software',
  MANUAL_PROCESS: 'Manual process',
  OTHER: 'Other',
};

export const processChallengeLabels: Record<ProcessChallenge, string> = {
  TOO_MANY_APPLICATIONS: 'Too many applications',
  MANUAL_SCREENING: 'Manual screening',
  DOCUMENT_VERIFICATION: 'Document verification',
  FINDING_ELIGIBLE_APPLICANTS: 'Finding eligible applicants',
  COMMUNICATION: 'Communication',
  SHORTLISTING: 'Shortlisting',
  REPORTING: 'Reporting',
  FRAUD_DUPLICATES: 'Fraud / duplicate applications',
  TRACKING_BENEFICIARIES: 'Tracking beneficiaries',
  OTHER: 'Other',
};

export const fundingTypeLabels: Record<FundingType, string> = {
  BURSARY: 'Bursary',
  SCHOLARSHIP: 'Scholarship',
  GRANT: 'Grant',
  OTHER: 'Other',
};

export const fundingCoverageLabels: Record<FundingCoverage, string> = {
  TUITION_FEES: 'Tuition fees',
  REGISTRATION_FEES: 'Registration fees',
  ACCOMMODATION: 'Accommodation',
  MEALS_LIVING: 'Meals / living allowance',
  BOOKS_MATERIALS: 'Books and study materials',
  LAPTOP_DEVICE: 'Laptop allowance',
  TRANSPORT: 'Transport',
  OTHER: 'Other',
};

export const programmeStatusLabels: Record<ProgrammeStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Active',
  CLOSED: 'Closed',
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  DOCUMENTS_REQUIRED: 'Documents Required',
  SHORTLISTED: 'Shortlisted',
  APPROVED: 'Approved',
  UNSUCCESSFUL: 'Unsuccessful',
};

export const matchClassificationLabels: Record<MatchClassification, string> = {
  STRONG_MATCH: 'Strong Match',
  POTENTIAL_MATCH: 'Potential Match',
  MORE_INFO_NEEDED: 'More Information Needed',
};

export const documentTypeLabels: Record<DocumentType, string> = {
  ID_DOCUMENT: 'ID document',
  ACADEMIC_RECORD: 'Academic record',
  TRANSCRIPT: 'Academic transcript',
  MATRIC_CERTIFICATE: 'Matric certificate',
  PROOF_OF_RESIDENCE: 'Proof of residence',
  PROOF_OF_INCOME: 'Proof of income',
  PROOF_OF_REGISTRATION: 'Proof of registration',
  CV: 'CV',
  MOTIVATION_LETTER: 'Motivation letter',
  OTHER: 'Other',
};

export const shortlistStatusLabels: Record<ShortlistStatus, string> = {
  SHORTLISTED: 'Shortlisted',
  SELECTED: 'Selected',
  WITHDRAWN: 'Withdrawn',
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  NEW_MATCH: 'New opportunity match',
  APPLICATION_SUBMITTED: 'Application submitted',
  APPLICATION_STATUS_CHANGED: 'Application status changed',
  DEADLINE_APPROACHING: 'Deadline approaching',
  INFORMATION_REQUESTED: 'Information requested',
  PROGRAMME_PUBLISHED: 'Programme published',
  WELCOME: 'Welcome',
};
