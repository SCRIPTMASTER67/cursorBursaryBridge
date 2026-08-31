import { z } from 'zod';

/**
 * Applications reuse the student's stored profile; only programme-specific
 * answers and document links are submitted here.
 */
export const applicationDraftSchema = z.object({
  fundingProgrammeId: z.string().cuid(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.number(), z.boolean()])).default({}),
  documentIds: z.array(z.string().cuid()).default([]),
});

export const submitApplicationSchema = applicationDraftSchema.extend({
  confirmAccurate: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm your information is accurate' }),
  }),
});

export const applicationDecisionSchema = z.object({
  status: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'DOCUMENTS_REQUIRED',
    'SHORTLISTED',
    'APPROVED',
    'UNSUCCESSFUL',
  ]),
  note: z.string().max(2000).optional().or(z.literal('')),
});

export type ApplicationDraftInput = z.infer<typeof applicationDraftSchema>;
export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
