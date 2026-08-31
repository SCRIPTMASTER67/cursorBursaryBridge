import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireCorporateOnboarding } from '@/lib/auth/corporate-onboarding';
import { OrganisationDetailsForm } from './details-form';

export const metadata: Metadata = { title: 'Organisation details' };

export default async function OrganisationDetailsPage() {
  const { organisationId } = await requireCorporateOnboarding();
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { name: true, type: true, industry: true, website: true, country: true, createdAt: true, updatedAt: true },
  });

  // The account step seeds a placeholder name from the email domain; blank it
  // so the funder types their real organisation name rather than editing it.
  const isPlaceholder = organisation.createdAt.getTime() === organisation.updatedAt.getTime();

  return (
    <OrganisationDetailsForm
      initial={{
        name: isPlaceholder ? '' : organisation.name,
        type: organisation.type,
        industry: organisation.industry,
        website: organisation.website ?? '',
        country: organisation.country,
      }}
    />
  );
}
