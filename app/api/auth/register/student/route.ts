import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, zodFields } from '@/lib/auth/api';
import { hashPassword } from '@/lib/auth/password';
import { createSession, generateToken } from '@/lib/auth/session';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { studentRegistrationSchema } from '@/lib/validation/auth';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { audit } from '@/services/audit';
import { notify } from '@/services/notifications';

/**
 * Step 1 of the student journey: create the account, start a session and send
 * the verification email. The empty StudentProfile is created here so the
 * onboarding steps have a row to write into.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limit = rateLimit(`register:${ip}`, 5, 600);
  if (!limit.allowed) {
    return apiError(
      `Too many sign-up attempts. Please try again in ${limit.retryAfterSeconds} seconds.`,
      429,
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return apiError('Invalid request.');

  const parsed = studentRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
  }

  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) {
    return apiError('That email address is already registered.', 409, {
      email: 'An account with this email already exists. Try logging in instead.',
    });
  }

  const verificationToken = generateToken();

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: 'STUDENT',
      firstName: data.firstName,
      lastName: data.lastName,
      mobile: data.mobile,
      emailNotifications: data.emailNotifications,
      acceptedTermsAt: new Date(),
      studentProfile: { create: { onboardingStep: 'education' } },
      verificationToken: {
        create: {
          tokenHash: createHash('sha256').update(verificationToken).digest('hex'),
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        },
      },
    },
    select: { id: true, email: true, firstName: true },
  });

  await createSession(user.id, { userAgent: request.headers.get('user-agent'), ipAddress: ip });

  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/verify?token=${verificationToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your Bursary-Bridge email address',
    heading: `Welcome to Bursary-Bridge, ${user.firstName}!`,
    body: 'Please confirm your email address so we can send you matched funding opportunities and deadline reminders.',
    actionLabel: 'Verify my email',
    actionUrl: verifyUrl,
  });

  await notify({
    userId: user.id,
    type: 'WELCOME',
    title: 'Welcome to Bursary-Bridge',
    body: 'Complete your profile to start receiving funding opportunities matched to your education journey.',
    link: '/onboarding/student/education',
  });

  await audit({ userId: user.id, action: 'student.registered', entityType: 'User', entityId: user.id, ipAddress: ip });

  return apiOk({ ok: true, redirectTo: '/verify' }, 201);
}
