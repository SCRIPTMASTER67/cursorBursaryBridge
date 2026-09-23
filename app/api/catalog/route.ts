import { prisma } from '@/lib/db';
import { apiOk, apiUser } from '@/lib/auth/api';

/**
 * The standardised catalogue of institutions and courses.
 *
 * Served in one call because both lists are small and bounded, and every
 * screen that needs one needs the other (a study preference is always a course
 * paired with an institution).
 */
export async function GET() {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  // Active entries only. A retired institution keeps working everywhere it is
  // already referenced; it simply stops being offered for new choices.
  const [institutions, programmes, links] = await Promise.all([
    prisma.institution.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, shortName: true, type: true, province: true, city: true },
      orderBy: { name: 'asc' },
    }),
    prisma.programme.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, field: true, qualificationLevels: true },
      orderBy: { name: 'asc' },
    }),
    prisma.programmeInstitution.findMany({
      where: { programme: { status: 'ACTIVE' }, institution: { status: 'ACTIVE' } },
      select: { programmeId: true, institutionId: true },
    }),
  ]);

  const offeredAt: Record<string, string[]> = {};
  for (const link of links) {
    (offeredAt[link.institutionId] ??= []).push(link.programmeId);
  }

  return apiOk({ institutions, programmes, offeredAt });
}
