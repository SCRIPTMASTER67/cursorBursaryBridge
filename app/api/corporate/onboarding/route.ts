import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, apiCorporate, zodFields } from '@/lib/auth/api';
import {
  corporateRoleSchema,
  currentProcessSchema,
  fundingProfileSchema,
  organisationDetailsSchema,
} from '@/lib/validation/corporate';
import { corporateSteps, type CorporateStepKey } from '@/lib/onboarding-steps';
import { audit } from '@/services/audit';

const stepOrder = corporateSteps.map((step) => step.key);

/**
 * Corporate onboarding, one endpoint per step.
 *
 * Every write is scoped to the caller's own organisationId, so a corporate
 * user can never modify another organisation's record.
 */
export async function POST(request: NextRequest) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { step?: string; data?: unknown } | null;
  if (!body?.step || !body.data) return apiError('Invalid request.');

  const step = body.step as CorporateStepKey;
  const { organisationId, corporateProfileId } = auth;

  switch (step) {
    case 'details': {
      const parsed = organisationDetailsSchema.safeParse(body.data);
      if (!parsed.success) return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
      const d = parsed.data;

      // Organisation names are unique, so a clash needs a readable message
      // rather than a database constraint error.
      const clash = await prisma.organisation.findFirst({
        where: { name: d.name, id: { not: organisationId } },
        select: { id: true },
      });
      if (clash) {
        return apiError('An organisation with that name is already registered.', 409, {
          name: 'This organisation name is already in use',
        });
      }

      await prisma.organisation.update({
        where: { id: organisationId },
        data: {
          name: d.name,
          type: d.type,
          industry: d.industry,
          website: d.website || null,
          country: d.country,
        },
      });
      break;
    }

    case 'role': {
      const parsed = corporateRoleSchema.safeParse(body.data);
      if (!parsed.success) return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
      await prisma.corporateProfile.update({
        where: { id: corporateProfileId },
        data: {
          role: parsed.data.role,
          organisationSize: parsed.data.organisationSize,
          department: parsed.data.department || null,
        },
      });
      break;
    }

    case 'funding': {
      const parsed = fundingProfileSchema.safeParse(body.data);
      if (!parsed.success) return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
      await prisma.organisation.update({
        where: { id: organisationId },
        data: {
          offersFunding: parsed.data.offersFunding,
          programmeTypes: parsed.data.programmeTypes,
          applicationVolume: parsed.data.applicationVolume,
        },
      });
      break;
    }

    case 'process': {
      const parsed = currentProcessSchema.safeParse(body.data);
      if (!parsed.success) return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
      await prisma.organisation.update({
        where: { id: organisationId },
        data: { processMethods: parsed.data.processMethods, challenges: parsed.data.challenges },
      });
      break;
    }

    case 'review': {
      const organisation = await prisma.organisation.findUniqueOrThrow({
        where: { id: organisationId },
        select: { name: true, type: true, industry: true },
      });
      const profile = await prisma.corporateProfile.findUniqueOrThrow({
        where: { id: corporateProfileId },
        select: { role: true },
      });
      if (!organisation.name || !profile.role) {
        return apiError('Complete the earlier steps before creating your organisation.', 422);
      }

      await prisma.corporateProfile.update({
        where: { id: corporateProfileId },
        data: { onboardingCompletedAt: new Date(), onboardingStep: 'review' },
      });
      await audit({
        userId: auth.user.id,
        action: 'corporate.onboarding_completed',
        entityType: 'Organisation',
        entityId: organisationId,
      });

      return apiOk({ ok: true, redirectTo: '/corporate/dashboard' });
    }

    default:
      return apiError('Unknown onboarding step.');
  }

  // Advance the cursor, never backwards.
  const currentIndex = stepOrder.indexOf(step);
  const next = stepOrder[currentIndex + 1] ?? null;
  const profile = await prisma.corporateProfile.findUniqueOrThrow({
    where: { id: corporateProfileId },
    select: { onboardingStep: true, onboardingCompletedAt: true },
  });

  if (!profile.onboardingCompletedAt && next) {
    const storedIndex = stepOrder.indexOf(profile.onboardingStep as CorporateStepKey);
    if (stepOrder.indexOf(next) > storedIndex) {
      await prisma.corporateProfile.update({
        where: { id: corporateProfileId },
        data: { onboardingStep: next },
      });
    }
  }

  return apiOk({
    ok: true,
    redirectTo: next ? `/onboarding/organisation/${next}` : '/corporate/dashboard',
  });
}
