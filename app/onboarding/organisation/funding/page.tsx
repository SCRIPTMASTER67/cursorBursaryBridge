import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireCorporateOnboarding } from '@/lib/auth/corporate-onboarding';
import { FundingProfileForm } from './funding-form';

export const metadata: Metadata = { title: 'Funding programmes' };

export default async function CorporateFundingPage() {
  const { organisationId } = await requireCorporateOnboarding();
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { offersFunding: true, programmeTypes: true, applicationVolume: true },
  });
  return <FundingProfileForm initial={organisation} />;
}
