import 'server-only';
import type { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/db';

const PAGE_SIZE = 25;

/**
 * Organisation list for the admin portal.
 *
 * Counts of programmes and applications are shown so an administrator can see
 * the size of what a suspension would affect before applying one.
 */
export async function listOrganisations(options: {
  query?: string;
  status?: AccountStatus;
  page?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const q = options.query?.trim();
  const where = {
    ...(options.status ? { status: options.status } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.organisation.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        industry: true,
        createdAt: true,
        _count: { select: { programmes: true, members: true, applications: true } },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.organisation.count({ where }),
  ]);

  return { rows, total, page, pageSize: PAGE_SIZE };
}

export async function getOrganisationDetail(organisationId: string) {
  return prisma.organisation.findUnique({
    where: { id: organisationId },
    select: {
      id: true,
      name: true,
      status: true,
      type: true,
      industry: true,
      website: true,
      description: true,
      createdAt: true,
      programmes: {
        select: {
          id: true,
          name: true,
          status: true,
          fundingType: true,
          openDate: true,
          closingDate: true,
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      members: {
        select: {
          id: true,
          role: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, status: true },
          },
        },
      },
    },
  });
}
