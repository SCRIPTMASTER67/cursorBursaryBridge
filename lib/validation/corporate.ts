import { z } from 'zod';

/** Server-side schemas for the corporate onboarding journey. */

export const organisationDetailsSchema = z.object({
  name: z
    .string()
    .min(2, 'Organisation name is required')
    .max(120, 'Organisation name must be 120 characters or fewer')
    .transform((v) => v.trim()),
  type: z.enum([
    'CORPORATION',
    'FOUNDATION',
    'NGO',
    'NON_PROFIT',
    'PROFESSIONAL_ORGANISATION',
    'GOVERNMENT_ORGANISATION',
    'EDUCATIONAL_ORGANISATION',
    'OTHER',
  ]),
  industry: z.enum([
    'FINANCIAL_SERVICES',
    'MINING',
    'TECHNOLOGY',
    'TELECOMMUNICATIONS',
    'ENGINEERING',
    'HEALTHCARE',
    'ENERGY',
    'MANUFACTURING',
    'RETAIL',
    'CONSTRUCTION',
    'PROFESSIONAL_SERVICES',
    'OTHER',
  ]),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || /^https?:\/\/.+\..+/.test(v), 'Enter a valid website URL, including https://'),
  country: z.string().min(1, 'Country is required').default('South Africa'),
});

export const corporateRoleSchema = z.object({
  role: z.enum([
    'BURSARY_FUNDING_MANAGER',
    'HR_MANAGER',
    'TALENT_MANAGER',
    'CSI_MANAGER',
    'FOUNDATION_MANAGER',
    'PROGRAMME_MANAGER',
    'ADMINISTRATOR',
    'EXECUTIVE',
    'OTHER',
  ]),
  organisationSize: z.enum([
    'UNDER_50',
    'SIZE_50_250',
    'SIZE_251_1000',
    'SIZE_1001_5000',
    'ABOVE_5000',
  ]),
  department: z.string().max(120).optional().or(z.literal('')),
});

export const fundingProfileSchema = z.object({
  offersFunding: z.enum(['YES', 'NO', 'PLANNING_TO', 'NOT_SURE']),
  programmeTypes: z
    .array(
      z.enum([
        'BURSARIES',
        'SCHOLARSHIPS',
        'GRANTS',
        'INTERNSHIPS',
        'LEARNERSHIPS',
        'GRADUATE_PROGRAMMES',
        'OTHER',
      ]),
    )
    .min(1, 'Select at least one programme type'),
  applicationVolume: z.enum([
    'UNDER_100',
    'V100_500',
    'V501_1000',
    'V1001_5000',
    'V5001_10000',
    'ABOVE_10000',
  ]),
});

export const MAX_CHALLENGES = 3;

export const currentProcessSchema = z.object({
  processMethods: z
    .array(
      z.enum([
        'EMAIL',
        'SPREADSHEETS',
        'GOOGLE_FORMS',
        'WEBSITE_FORMS',
        'DEDICATED_SOFTWARE',
        'MANUAL_PROCESS',
        'OTHER',
      ]),
    )
    .default([]),
  challenges: z
    .array(
      z.enum([
        'TOO_MANY_APPLICATIONS',
        'MANUAL_SCREENING',
        'DOCUMENT_VERIFICATION',
        'FINDING_ELIGIBLE_APPLICANTS',
        'COMMUNICATION',
        'SHORTLISTING',
        'REPORTING',
        'FRAUD_DUPLICATES',
        'TRACKING_BENEFICIARIES',
        'OTHER',
      ]),
    )
    .max(MAX_CHALLENGES, `Select up to ${MAX_CHALLENGES} challenges`)
    .default([]),
});

export type OrganisationDetailsInput = z.infer<typeof organisationDetailsSchema>;
export type CorporateRoleInput = z.infer<typeof corporateRoleSchema>;
export type FundingProfileInput = z.infer<typeof fundingProfileSchema>;
export type CurrentProcessInput = z.infer<typeof currentProcessSchema>;
