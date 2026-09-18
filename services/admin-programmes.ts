import 'server-only';
import type { ProgrammeStatus } from '@prisma/client';
import { prisma } from '@/lib/db';

const PAGE_SIZE = 25;

/**
 * Every funding programme across every organisation.
 *
 * This is the one place in the system that reads programmes unscoped by
 * organisationId. It exists so policy breaches can be found; it exposes the
 * programme record only, never the applications attached to it.
 */
export async function listAllProgrammes(options: {
  query?: string;
  status?: ProgrammeStatus;
  page?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const q = options.query?.trim();
  const where = {
    ...(options.status ? { status: options.status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { organisation: { name: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.fundingProgramme.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        fundingType: true,
        openDate: true,
        closingDate: true,
        createdAt: true,
        organisation: { select: { id: true, name: true, status: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.fundingProgramme.count({ where }),
  ]);

  return { rows, total, page, pageSize: PAGE_SIZE };
}
