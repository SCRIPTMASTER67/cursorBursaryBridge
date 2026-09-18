import { z } from 'zod';

/**
 * Admin input schemas.
 *
 * As everywhere else in the system these are the server-side source of truth;
 * the same schemas are used in the browser only to give immediate feedback.
 */

/** A reason is required wherever an admin action affects someone else's work. */
const reason = z
  .string()
  .trim()
  .min(10, 'Give a reason of at least 10 characters')
  .max(500, 'Keep the reason under 500 characters');

export const suspendAccountSchema = z.object({ reason });
export const reactivateAccountSchema = z.object({ reason });
export const forcePasswordResetSchema = z.object({ reason });
export const unpublishProgrammeSchema = z.object({ reason });
export const restoreProgrammeSchema = z.object({ reason });

export const institutionSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(160),
  shortName: z.string().trim().max(24).optional().or(z.literal('')),
  type: z.enum([
    'UNIVERSITY',
    'UNIVERSITY_OF_TECHNOLOGY',
    'TVET_COLLEGE',
    'PRIVATE_INSTITUTION',
    'OTHER',
  ]),
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
  city: z.string().trim().min(2, 'City is required').max(80),
});

export const courseSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(160),
  field: z.string().trim().min(2, 'Field is required'),
  qualificationLevels: z.array(z.string()).min(1, 'Select at least one qualification level'),
});

/** Audit log filters. Every field is optional; an empty filter lists everything. */
export const auditFilterSchema = z.object({
  actor: z.string().trim().max(200).optional(),
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(60).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type SuspendAccountInput = z.infer<typeof suspendAccountSchema>;
export type InstitutionInput = z.infer<typeof institutionSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type AuditFilter = z.infer<typeof auditFilterSchema>;
