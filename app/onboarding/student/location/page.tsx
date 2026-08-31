import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireStudent } from '@/lib/auth/guards';
import { LocationForm } from './location-form';

export const metadata: Metadata = { title: 'Location & interests' };

export default async function LocationStepPage() {
  const { studentProfileId } = await requireStudent();
  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentProfileId },
    select: { province: true, city: true, studyLocationPreference: true, careerInterests: true },
  });
  return <LocationForm initial={profile} />;
}
