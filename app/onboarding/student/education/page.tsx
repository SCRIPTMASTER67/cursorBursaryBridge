import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireStudent } from '@/lib/auth/guards';
import { getCatalog } from '@/services/catalog';
import { EducationForm } from './education-form';

export const metadata: Metadata = { title: 'Your education journey' };

export default async function EducationStepPage() {
  const { studentProfileId } = await requireStudent();

  const [profile, catalog] = await Promise.all([
    prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentProfileId },
      select: {
        educationStage: true,
        qualificationLevel: true,
        studyStatus: true,
        currentInstitutionId: true,
        currentProgrammeId: true,
        yearOfStudy: true,
      },
    }),
    getCatalog(),
  ]);

  return <EducationForm initial={profile} catalog={catalog} />;
}
