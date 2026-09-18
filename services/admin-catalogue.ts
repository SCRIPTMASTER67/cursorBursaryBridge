import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Shared reference data that Study Preferences and Eligibility Rules point at.
 *
 * Usage counts are returned with each row because the foreign keys from
 * StudyPreference are `onDelete: Restrict`: an entry a student is using cannot
 * be deleted, and the screen should say so before the attempt rather than
 * surfacing a database error afterwards.
 */
export async function listInstitutions(query?: string) {
  const q = query?.trim();
  return prisma.institution.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      shortName: true,
      type: true,
      province: true,
      city: true,
      _count: {
        select: { studyPreferences: true, currentStudents: true, supportedInProgram: true },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function listCourses(query?: string) {
  const q = query?.trim();
  return prisma.programme.findMany({
    where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
    select: {
      id: true,
      name: true,
      field: true,
      qualificationLevels: true,
      _count: {
        select: { studyPreferences: true, currentStudents: true, supportedInProgram: true },
      },
    },
    orderBy: { name: 'asc' },
  });
}

/** True when the row is referenced and therefore cannot be removed. */
export function isCatalogueEntryInUse(counts: {
  studyPreferences: number;
  currentStudents: number;
  supportedInProgram: number;
}): boolean {
  return counts.studyPreferences > 0 || counts.currentStudents > 0 || counts.supportedInProgram > 0;
}
