import { z } from 'zod';

/**
 * Password policy. Mirrored by `passwordRules` in lib/auth/password.ts, which
 * drives the live checklist shown under the password field.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const emailSchema = z
  .string()
  .min(1, 'Email address is required')
  .email('Enter a valid email address')
  .transform((v) => v.trim().toLowerCase());

/** South African mobile numbers, accepting 0XX and +27 forms. */
export const mobileSchema = z
  .string()
  .min(1, 'Mobile number is required')
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .refine((v) => /^(\+27|0)[6-8][0-9]{8}$/.test(v), 'Enter a valid South African mobile number');

const nameSchema = (field: string) =>
  z
    .string()
    .min(1, `${field} is required`)
    .max(60, `${field} must be 60 characters or fewer`)
    .transform((v) => v.trim());

const baseRegistration = {
  firstName: nameSchema('First name'),
  lastName: nameSchema('Last name'),
  email: emailSchema,
  mobile: mobileSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  emailNotifications: z.boolean().default(true),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Notice' }),
  }),
};

export const studentRegistrationSchema = z
  .object(baseRegistration)
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const corporateRegistrationSchema = z
  .object(baseRegistration)
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;
export type CorporateRegistrationInput = z.infer<typeof corporateRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
