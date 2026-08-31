import { z } from 'zod';

/**
 * Server-side schemas for each step of the student onboarding journey.
 * The client renders inline errors from the same messages.
 */

export const MAX_STUDY_PREFERENCES = 6;

export const educationSchema = z
  .object({
    educationStage: z.enum([
      'GRADE_10',
      'GRADE_11',
      'MATRIC',
      'UNIVERSITY_FIRST_YEAR',
      'UNIVERSITY_CURRENT',
      'TVET_COLLEGE',
      'POSTGRADUATE',
      'PLANNING_TO_STUDY',
      'OTHER',
    ]),
    qualificationLevel: z
      .enum([
        'CERTIFICATE',
        'DIPLOMA',
        'ADVANCED_DIPLOMA',
        'BACHELORS',
        'HONOURS',
        'MASTERS',
        'DOCTORAL',
        'OTHER',
      ])
      .nullish(),
    studyStatus: z.enum([
      'CURRENTLY_ENROLLED',
      'ACCEPTED_NOT_REGISTERED',
      'APPLIED_AWAITING',
      'PLANNING_TO_APPLY',
      'RETURNING_STUDENT',
      'OTHER',
    ]),
    currentInstitutionId: z.string().cuid().nullish(),
    currentProgrammeId: z.string().cuid().nullish(),
    yearOfStudy: z.coerce.number().int().min(1).max(8).nullish(),
  })
  .superRefine((data, ctx) => {
    // Grade 10/11 learners are never asked for a tertiary qualification.
    const isSchoolLearner = data.educationStage === 'GRADE_10' || data.educationStage === 'GRADE_11';
    if (!isSchoolLearner && !data.qualificationLevel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['qualificationLevel'],
        message: 'Select the qualification level you plan to study',
      });
    }
    // Enrolled students must tell us where and what they are studying.
    if (data.studyStatus === 'CURRENTLY_ENROLLED') {
      if (!data.currentInstitutionId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currentInstitutionId'],
          message: 'Select your current institution',
        });
      }
      if (!data.currentProgrammeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currentProgrammeId'],
          message: 'Select your current programme',
        });
      }
      if (!data.yearOfStudy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['yearOfStudy'],
          message: 'Select your year of study',
        });
      }
    }
  });

export const studyPreferenceSchema = z.object({
  programmeId: z.string().cuid('Select a course or programme'),
  institutionId: z.string().cuid('Select an institution'),
});

export const studyPreferencesSchema = z.object({
  preferences: z
    .array(studyPreferenceSchema)
    .min(1, 'Add at least one study preference')
    .max(MAX_STUDY_PREFERENCES, `You can add up to ${MAX_STUDY_PREFERENCES} study preferences`)
    .refine(
      (prefs) => {
        const seen = new Set(prefs.map((p) => `${p.programmeId}:${p.institutionId}`));
        return seen.size === prefs.length;
      },
      { message: 'Each course and institution combination must be unique' },
    ),
});

export const academicSchema = z
  .object({
    academicAverage: z.coerce
      .number()
      .int('Enter a whole percentage')
      .min(0, 'Average cannot be below 0%')
      .max(100, 'Average cannot be above 100%')
      .nullish(),
    academicAverageUnknown: z.boolean().default(false),
    resultTypes: z
      .array(
        z.enum([
          'SCHOOL_REPORT',
          'MATRIC_RESULTS',
          'UNIVERSITY_TRANSCRIPT',
          'ACADEMIC_RECORD',
          'OTHER',
          'NONE_YET',
        ]),
      )
      .default([]),
    achievements: z
      .array(
        z.enum([
          'SUBJECT_DISTINCTIONS',
          'ACADEMIC_AWARDS',
          'DEANS_LIST',
          'COMPETITIONS',
          'OLYMPIADS',
          'RESEARCH',
          'OTHER',
          'NONE',
        ]),
      )
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.academicAverageUnknown && (data.academicAverage === null || data.academicAverage === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['academicAverage'],
        message: "Enter your latest average, or tick “I don't know”",
      });
    }
  });

export const fundingSchema = z.object({
  fundingNeeds: z
    .array(
      z.enum([
        'TUITION_FEES',
        'REGISTRATION_FEES',
        'ACCOMMODATION',
        'BOOKS_MATERIALS',
        'MEALS_LIVING',
        'TRANSPORT',
        'LAPTOP_DEVICE',
        'OTHER_EXPENSES',
        'FULL_FUNDING',
        'PARTIAL_FUNDING',
        'NOT_SURE',
      ]),
    )
    .min(1, 'Select at least one funding need'),
  fundingSituation: z.enum([
    'NO_FUNDING',
    'PARTIALLY_FUNDED',
    'FULLY_FUNDED',
    'AWAITING_DECISION',
    'DONT_KNOW',
  ]),
});

export const financialSchema = z.object({
  householdIncome: z.enum([
    'BELOW_50K',
    'R50K_100K',
    'R100K_200K',
    'R200K_350K',
    'R350K_500K',
    'ABOVE_500K',
    'DONT_KNOW',
    'PREFER_NOT_TO_SAY',
  ]),
  bursaryStatus: z.enum(['YES', 'NO', 'APPLICATION_PENDING', 'PREFER_NOT_TO_SAY']),
  dateOfBirth: z
    .string()
    .nullish()
    .refine(
      (v) => {
        if (!v) return true;
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return false;
        const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000);
        return age >= 13 && age <= 80;
      },
      { message: 'Enter a valid date of birth' },
    ),
  citizenship: z
    .enum(['SA_CITIZEN', 'PERMANENT_RESIDENT', 'OTHER', 'PREFER_NOT_TO_SAY'])
    .nullish(),
  firstGeneration: z.enum(['YES', 'NO', 'PREFER_NOT_TO_SAY']).nullish(),
  disability: z.enum(['YES', 'NO', 'PREFER_NOT_TO_SAY']).nullish(),
  orphanVulnerable: z.enum(['YES', 'NO', 'PREFER_NOT_TO_SAY']).nullish(),
});

export const MAX_CAREER_INTERESTS = 5;

export const locationSchema = z.object({
  province: z.enum([
    'EASTERN_CAPE',
    'FREE_STATE',
    'GAUTENG',
    'KWAZULU_NATAL',
    'LIMPOPO',
    'MPUMALANGA',
    'NORTHERN_CAPE',
    'NORTH_WEST',
    'WESTERN_CAPE',
  ]),
  city: z.string().min(1, 'Select your city or town').max(80),
  studyLocationPreference: z.enum(['SAME_LOCATION', 'DIFFERENT_LOCATION', 'NOT_SURE']),
  careerInterests: z
    .array(
      z.enum([
        'TECHNOLOGY',
        'ENGINEERING',
        'HEALTHCARE',
        'FINANCE_ACCOUNTING',
        'LAW',
        'EDUCATION',
        'AGRICULTURE',
        'SCIENCE_RESEARCH',
        'BUSINESS',
        'GOVERNMENT',
        'MINING',
        'ENERGY',
        'MANUFACTURING',
        'CONSTRUCTION',
        'MEDIA_COMMUNICATIONS',
        'OTHER',
      ]),
    )
    .min(1, 'Select at least one career interest')
    .max(MAX_CAREER_INTERESTS, `Select up to ${MAX_CAREER_INTERESTS} interests`),
});

export type EducationInput = z.infer<typeof educationSchema>;
export type StudyPreferencesInput = z.infer<typeof studyPreferencesSchema>;
export type AcademicInput = z.infer<typeof academicSchema>;
export type FundingInput = z.infer<typeof fundingSchema>;
export type FinancialInput = z.infer<typeof financialSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
