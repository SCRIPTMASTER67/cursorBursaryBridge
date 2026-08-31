import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireStudent } from '@/lib/auth/guards';
import { AcademicForm } from './academic-form';

export const metadata: Metadata = { title: 'Academic profile' };

export default async function AcademicStepPage() {
  const { studentProfileId } = await requireStudent();
  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentProfileId },
    select: {
      academicAverage: true,
      academicAverageUnknown: true,
      resultTypes: true,
      achievements: true,
    },
  });
  return <AcademicForm initial={profile} />;
}
