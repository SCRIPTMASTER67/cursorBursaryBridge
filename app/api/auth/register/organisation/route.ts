import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, zodFields } from '@/lib/auth/api';
import { hashPassword } from '@/lib/auth/password';
import { createSession, generateToken } from '@/lib/auth/session';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { corporateRegistrationSchema } from '@/lib/validation/auth';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { audit } from '@/services/audit';

/**
 * Step 1 of the corporate journey.
 *
 * The Organisation row is created empty and named after the user's email
 * domain; step 2 (Organisation Details) fills it in. Keeping the row from the
 * start means the CorporateProfile always has an organisation to scope to.
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

  const parsed = corporateRegistrationSchema.safeParse(body);
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
  const placeholderName = `${data.email.split('@')[1] ?? 'organisation'} (${data.lastName})`;

  const user = await prisma.$transaction(async (tx) => {
    const organisation = await tx.organisation.create({
      data: { name: placeholderName, type: 'CORPORATION', industry: 'OTHER' },
      select: { id: true },
    });

    return tx.user.create({
      data: {
        email: data.email,
        passwordHash: await hashPassword(data.password),
        role: 'CORPORATE',
        firstName: data.firstName,
        lastName: data.lastName,
        mobile: data.mobile,
        emailNotifications: data.emailNotifications,
        acceptedTermsAt: new Date(),
        corporateProfile: {
          create: { organisationId: organisation.id, onboardingStep: 'organisation' },
        },
        verificationToken: {
          create: {
            tokenHash: createHash('sha256').update(verificationToken).digest('hex'),
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          },
        },
      },
      select: { id: true, email: true, firstName: true },
    });
  });

  await createSession(user.id, { userAgent: request.headers.get('user-agent'), ipAddress: ip });

  await sendEmail({
    to: user.email,
    subject: 'Verify your Bursary-Bridge email address',
    heading: `Welcome to Bursary-Bridge, ${user.firstName}!`,
    body: 'Please confirm your email address so we can keep you updated on your funding programmes.',
    actionLabel: 'Verify my email',
    actionUrl: `${env.NEXT_PUBLIC_APP_URL}/verify?token=${verificationToken}`,
  });

  await audit({
    userId: user.id,
    action: 'corporate.registered',
    entityType: 'User',
    entityId: user.id,
    ipAddress: ip,
  });

  return apiOk({ ok: true, redirectTo: '/onboarding/organisation/details' }, 201);
}
