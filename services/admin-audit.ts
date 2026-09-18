import 'server-only';
import { prisma } from '@/lib/db';
import type { AuditFilter } from '@/lib/validation/admin';

const PAGE_SIZE = 50;

/**
 * Read-only view of the append-only audit trail.
 *
 * There is no write path here by design: an administrator can search the log
 * but cannot edit or delete an entry, which is what makes it worth keeping.
 * Filtering by action is served by the (action, createdAt) index.
 */
export async function searchAuditLog(filter: AuditFilter) {
  const page = Math.max(1, filter.page ?? 1);

  const from = filter.from ? new Date(filter.from) : undefined;
  const to = filter.to ? new Date(filter.to) : undefined;
  // An inclusive end date: the user means the whole of that day.
  if (to) to.setHours(23, 59, 59, 999);

  const where = {
    ...(filter.action ? { action: { contains: filter.action, mode: 'insensitive' as const } } : {}),
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(filter.entityId ? { entityId: filter.entityId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from && !Number.isNaN(+from) ? { gte: from } : {}),
            ...(to && !Number.isNaN(+to) ? { lte: to } : {}),
          },
        }
      : {}),
    ...(filter.actor
      ? {
          user: {
            OR: [
              { email: { contains: filter.actor, mode: 'insensitive' as const } },
              { firstName: { contains: filter.actor, mode: 'insensitive' as const } },
              { lastName: { contains: filter.actor, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows, total, page, pageSize: PAGE_SIZE };
}

/** The distinct actions present, so the filter can offer them rather than guess. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    select: { action: true },
    distinct: ['action'],
    orderBy: { action: 'asc' },
  });
  return rows.map((r) => r.action);
}
