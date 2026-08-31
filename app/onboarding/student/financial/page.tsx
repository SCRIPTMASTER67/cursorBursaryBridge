import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireStudent } from '@/lib/auth/guards';
import { FinancialForm } from './financial-form';

export const metadata: Metadata = { title: 'Financial profile' };

export default async function FinancialStepPage() {
  const { studentProfileId } = await requireStudent();
  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentProfileId },
    select: {
      householdIncome: true,
      bursaryStatus: true,
      dateOfBirth: true,
      citizenship: true,
      firstGeneration: true,
      disability: true,
      orphanVulnerable: true,
    },
  });

  return (
    <FinancialForm
      initial={{
        ...profile,
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : '',
      }}
    />
  );
}
