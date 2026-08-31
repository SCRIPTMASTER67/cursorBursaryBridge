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

  const [institutions, programmes] = await Promise.all([
    prisma.institution.findMany({
      select: { id: true, name: true, shortName: true, type: true, province: true, city: true },
      orderBy: { name: 'asc' },
    }),
    prisma.programme.findMany({
      select: { id: true, name: true, field: true, qualificationLevels: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return apiOk({ institutions, programmes });
}
