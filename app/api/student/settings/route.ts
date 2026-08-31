import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiError, apiOk, apiUser, zodFields } from '@/lib/auth/api';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { destroyAllSessions } from '@/lib/auth/session';
import { emailSchema, mobileSchema, passwordSchema } from '@/lib/validation/auth';
import { audit } from '@/services/audit';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(60),
  lastName: z.string().min(1, 'Last name is required').max(60),
  email: emailSchema,
  mobile: mobileSchema,
  emailNotifications: z.boolean(),
});

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** Update account details, or change the password. */
export async function PUT(request: NextRequest) {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { intent?: string } | null;
  if (!body) return apiError('Invalid request.');

  if (body.intent === 'password') {
    const parsed = passwordChangeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: auth.user.id },
      select: { passwordHash: true },
    });

    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return apiError('Your current password is incorrect.', 422, {
        currentPassword: 'That password is incorrect',
      });
    }

    await prisma.user.update({
      where: { id: auth.user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });

    // Every other session is invalidated so a stolen cookie cannot survive a
    // password change.
    await destroyAllSessions(auth.user.id);
    await audit({ userId: auth.user.id, action: 'auth.password_changed', entityType: 'User', entityId: auth.user.id });

    return apiOk({ ok: true, redirectTo: '/login', message: 'Password updated. Please sign in again.' });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
  }

  if (parsed.data.email !== auth.user.email) {
    const taken = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (taken) {
      return apiError('That email address is already in use.', 409, {
        email: 'This email is already registered',
      });
    }
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      mobile: parsed.data.mobile,
      emailNotifications: parsed.data.emailNotifications,
      // Changing the address means it must be verified again.
      emailVerifiedAt: parsed.data.email !== auth.user.email ? null : undefined,
    },
  });

  await audit({ userId: auth.user.id, action: 'user.profile_updated', entityType: 'User', entityId: auth.user.id });

  return apiOk({ ok: true, message: 'Your details have been updated.' });
}
