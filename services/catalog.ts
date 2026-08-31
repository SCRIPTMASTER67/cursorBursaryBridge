import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db';

export type CatalogInstitution = {
  id: string;
  name: string;
  shortName: string | null;
  province: string;
  city: string;
};

export type CatalogProgramme = {
  id: string;
  name: string;
  field: string;
};

/**
 * Reference data loader.
 *
 * Cached per request so a page rendering several preference rows hits the
 * database once rather than once per row.
 */
export const getCatalog = cache(
  async (): Promise<{ institutions: CatalogInstitution[]; programmes: CatalogProgramme[] }> => {
    const [institutions, programmes] = await Promise.all([
      prisma.institution.findMany({
        select: { id: true, name: true, shortName: true, province: true, city: true },
        orderBy: { name: 'asc' },
      }),
      prisma.programme.findMany({
        select: { id: true, name: true, field: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { institutions, programmes };
  },
);
