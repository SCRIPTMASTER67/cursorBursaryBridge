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
 *
 * Only active entries are returned, because this is what the pickers offer.
 * A student who already chose an institution that has since been retired keeps
 * their choice: everywhere that displays an existing selection resolves it
 * through the database relation, not through this list. Retiring stops
 * something being offered; it does not erase what somebody already picked.
 */
export const getCatalog = cache(
  async (): Promise<{
    institutions: CatalogInstitution[];
    programmes: CatalogProgramme[];
    /** Courses offered at each institution, for narrowing a study preference. */
    offeredAt: Record<string, string[]>;
  }> => {
    const [institutions, programmes, links] = await Promise.all([
      prisma.institution.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, shortName: true, province: true, city: true },
        orderBy: { name: 'asc' },
      }),
      prisma.programme.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, field: true },
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

    return { institutions, programmes, offeredAt };
  },
);
