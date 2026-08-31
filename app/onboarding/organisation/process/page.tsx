import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireCorporateOnboarding } from '@/lib/auth/corporate-onboarding';
import { CurrentProcessForm } from './process-form';

export const metadata: Metadata = { title: 'Current process' };

export default async function CurrentProcessPage() {
  const { organisationId } = await requireCorporateOnboarding();
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { processMethods: true, challenges: true },
  });
  return <CurrentProcessForm initial={organisation} />;
}
