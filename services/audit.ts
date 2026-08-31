import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Append-only audit trail. Deliberately fire-and-forget: an audit failure must
 * never break the user-facing operation it is recording.
 */
export async function audit(entry: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ? (entry.metadata as object) : undefined,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record entry', entry.action, error);
  }
}
