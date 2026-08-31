import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireStudent } from '@/lib/auth/guards';
import { FundingForm } from './funding-form';

export const metadata: Metadata = { title: 'Funding needs' };

export default async function FundingStepPage() {
  const { studentProfileId } = await requireStudent();
  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentProfileId },
    select: { fundingNeeds: true, fundingSituation: true },
  });
  return <FundingForm initial={profile} />;
}
