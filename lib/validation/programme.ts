import { z } from 'zod';

/**
 * Funding-programme creation and eligibility rules.
 *
 * Split into two schemas so the multi-step builder can validate each step in
 * isolation while the publish action validates the whole thing.
 */

export const programmeDetailsSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Programme name is required')
      .max(140, 'Programme name must be 140 characters or fewer')
      .transform((v) => v.trim()),
    shortDescription: z
      .string()
      .min(10, 'Add a short description of at least 10 characters')
      .max(280, 'Keep the short description under 280 characters'),
    fullDescription: z
      .string()
      .min(30, 'Add a full description of at least 30 characters')
      .max(5000),
    fundingType: z.enum(['BURSARY', 'SCHOLARSHIP', 'GRANT', 'OTHER']),
    coverage: z
      .array(
        z.enum([
          'TUITION_FEES',
          'REGISTRATION_FEES',
          'ACCOMMODATION',
          'MEALS_LIVING',
          'BOOKS_MATERIALS',
          'LAPTOP_DEVICE',
          'TRANSPORT',
          'OTHER',
        ]),
      )
      .min(1, 'Select what this programme funds'),
    openDate: z.string().min(1, 'Application open date is required'),
    closingDate: z.string().min(1, 'Application closing date is required'),
    intakeTarget: z.coerce.number().int().min(1).max(100_000).nullish(),
  })
  .superRefine((data, ctx) => {
    const open = new Date(data.openDate);
    const close = new Date(data.closingDate);
    if (Number.isNaN(open.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['openDate'], message: 'Enter a valid date' });
    }
    if (Number.isNaN(close.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['closingDate'], message: 'Enter a valid date' });
    }
    if (!Number.isNaN(open.getTime()) && !Number.isNaN(close.getTime()) && close <= open) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['closingDate'],
        message: 'The closing date must be after the opening date',
      });
    }
  });

export const eligibilitySchema = z.object({
  institutionIds: z.array(z.string().cuid()).default([]),
  programmeIds: z.array(z.string().cuid()).default([]),
  qualificationLevels: z
    .array(
      z.enum([
        'CERTIFICATE',
        'DIPLOMA',
        'ADVANCED_DIPLOMA',
        'BACHELORS',
        'HONOURS',
        'MASTERS',
        'DOCTORAL',
        'OTHER',
      ]),
    )
    .default([]),
  minAcademicAverage: z.coerce
    .number()
    .int('Enter a whole percentage')
    .min(0, 'Minimum average cannot be below 0%')
    .max(100, 'Minimum average cannot be above 100%')
    .nullish(),
  yearsOfStudy: z.array(z.coerce.number().int().min(1).max(8)).default([]),
  citizenship: z
    .array(z.enum(['SA_CITIZEN', 'PERMANENT_RESIDENT', 'OTHER', 'PREFER_NOT_TO_SAY']))
    .default([]),
  maxHouseholdIncome: z
    .enum([
      'BELOW_50K',
      'R50K_100K',
      'R100K_200K',
      'R200K_350K',
      'R350K_500K',
      'ABOVE_500K',
      'DONT_KNOW',
      'PREFER_NOT_TO_SAY',
    ])
    .nullish(),
  requiresFinancialNeed: z.boolean().default(false),
  provinces: z
    .array(
      z.enum([
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
    )
    .default([]),
  otherRequirements: z.string().max(2000).optional().or(z.literal('')),
  requiredDocuments: z
    .array(
      z.enum([
        'ID_DOCUMENT',
        'ACADEMIC_RECORD',
        'TRANSCRIPT',
        'MATRIC_CERTIFICATE',
        'PROOF_OF_RESIDENCE',
        'PROOF_OF_INCOME',
        'PROOF_OF_REGISTRATION',
        'CV',
        'MOTIVATION_LETTER',
        'OTHER',
      ]),
    )
    .default([]),
});

export const applicationQuestionSchema = z.object({
  label: z.string().min(3, 'Question text is required').max(300),
  helpText: z.string().max(300).optional().or(z.literal('')),
  type: z.enum([
    'SHORT_TEXT',
    'LONG_TEXT',
    'SINGLE_SELECT',
    'MULTI_SELECT',
    'NUMBER',
    'DATE',
    'YES_NO',
  ]),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(120)).default([]),
});

export const createProgrammeSchema = z.object({
  details: programmeDetailsSchema,
  eligibility: eligibilitySchema,
  questions: z.array(applicationQuestionSchema).max(20).default([]),
  publish: z.boolean().default(false),
});

export type ProgrammeDetailsInput = z.infer<typeof programmeDetailsSchema>;
export type EligibilityInput = z.infer<typeof eligibilitySchema>;
export type CreateProgrammeInput = z.infer<typeof createProgrammeSchema>;
