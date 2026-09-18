import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { apiAdmin, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { clientIp } from '@/lib/auth/rate-limit';
import { audit } from '@/services/audit';
import { institutionSchema } from '@/lib/validation/admin';

const writeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE'), data: institutionSchema }),
  z.object({ action: z.literal('UPDATE'), id: z.string().cuid(), data: institutionSchema }),
  z.object({ action: z.literal('DELETE'), id: z.string().cuid() }),
]);

/**
 * Institution catalogue.
 *
 * Deletion is guarded by the database: StudyPreference references institutions
 * with onDelete: Restrict, so an institution a student has chosen cannot be
 * removed. That error is caught and returned as a readable message rather than
 * surfacing as a 500.
 */
export async function POST(request: NextRequest) {
  const auth = await apiAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = writeSchema.safeParse(body);
  if (!parsed.success)
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));

  const ip = clientIp(request);

  if (parsed.data.action === 'CREATE') {
    const { shortName, ...rest } = parsed.data.data;
    const created = await prisma.institution.create({
      data: { ...rest, shortName: shortName?.trim() ? shortName.trim() : null },
      select: { id: true, name: true },
    });
    await audit({
      userId: auth.adminUserId,
      action: 'admin.institution_created',
      entityType: 'Institution',
      entityId: created.id,
      metadata: { name: created.name },
      ipAddress: ip,
    });
    return apiOk({ ok: true, id: created.id }, 201);
  }

  if (parsed.data.action === 'UPDATE') {
    const { shortName, ...rest } = parsed.data.data;
    const updated = await prisma.institution.update({
      where: { id: parsed.data.id },
      data: { ...rest, shortName: shortName?.trim() ? shortName.trim() : null },
      select: { id: true, name: true },
    });
    await audit({
      userId: auth.adminUserId,
      action: 'admin.institution_updated',
      entityType: 'Institution',
      entityId: updated.id,
      metadata: { name: updated.name },
      ipAddress: ip,
    });
    return apiOk({ ok: true, id: updated.id });
  }

  const existing = await prisma.institution.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, name: true },
  });
  if (!existing) return apiError('Institution not found.', 404);

  try {
    await prisma.institution.delete({ where: { id: parsed.data.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return apiError(
        'This institution is in use by a student profile or a funding programme and cannot be removed.',
        409,
      );
    }
    throw error;
  }

  await audit({
    userId: auth.adminUserId,
    action: 'admin.institution_deleted',
    entityType: 'Institution',
    entityId: existing.id,
    metadata: { name: existing.name },
    ipAddress: ip,
  });
  return apiOk({ ok: true });
}
