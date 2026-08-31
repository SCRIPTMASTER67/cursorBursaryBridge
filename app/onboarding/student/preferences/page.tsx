import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireStudent } from '@/lib/auth/guards';
import { getCatalog } from '@/services/catalog';
import { PreferencesForm } from './preferences-form';

export const metadata: Metadata = { title: 'Study preferences' };

export default async function PreferencesStepPage() {
  const { studentProfileId } = await requireStudent();

  const [preferences, catalog] = await Promise.all([
    prisma.studyPreference.findMany({
      where: { studentProfileId },
      select: { preferenceNumber: true, programmeId: true, institutionId: true },
      orderBy: { preferenceNumber: 'asc' },
    }),
    getCatalog(),
  ]);

  return <PreferencesForm initial={preferences} catalog={catalog} />;
}
