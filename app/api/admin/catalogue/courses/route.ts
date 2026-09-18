import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, type CareerInterest, type QualificationLevel } from '@prisma/client';
import { prisma } from '@/lib/db';
import { apiAdmin, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { clientIp } from '@/lib/auth/rate-limit';
import { audit } from '@/services/audit';
import { courseSchema } from '@/lib/validation/admin';

const writeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE'), data: courseSchema }),
  z.object({ action: z.literal('UPDATE'), id: z.string().cuid(), data: courseSchema }),
  z.object({ action: z.literal('DELETE'), id: z.string().cuid() }),
]);

/**
 * Course catalogue. A Programme here is a course of study, distinct from a
 * FundingProgramme. Deletion is restricted by the same foreign keys as
 * institutions.
 */
export async function POST(request: NextRequest) {
  const auth = await apiAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = writeSchema.safeParse(body);
  if (!parsed.success)
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));

  const ip = clientIp(request);

  if (parsed.data.action !== 'DELETE') {
    const { name, field, qualificationLevels } = parsed.data.data;
    const data = {
      name,
      field: field as CareerInterest,
      qualificationLevels: qualificationLevels as QualificationLevel[],
    };
    const saved =
      parsed.data.action === 'CREATE'
        ? await prisma.programme.create({ data, select: { id: true, name: true } })
        : await prisma.programme.update({
            where: { id: parsed.data.id },
            data,
            select: { id: true, name: true },
          });
    await audit({
      userId: auth.adminUserId,
      action: parsed.data.action === 'CREATE' ? 'admin.course_created' : 'admin.course_updated',
      entityType: 'Programme',
      entityId: saved.id,
      metadata: { name: saved.name },
      ipAddress: ip,
    });
    return apiOk({ ok: true, id: saved.id }, parsed.data.action === 'CREATE' ? 201 : 200);
  }

  const existing = await prisma.programme.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, name: true },
  });
  if (!existing) return apiError('Course not found.', 404);

  try {
    await prisma.programme.delete({ where: { id: parsed.data.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return apiError(
        'This course is in use by a student profile or a funding programme and cannot be removed.',
        409,
      );
    }
    throw error;
  }

  await audit({
    userId: auth.adminUserId,
    action: 'admin.course_deleted',
    entityType: 'Programme',
    entityId: existing.id,
    metadata: { name: existing.name },
    ipAddress: ip,
  });
  return apiOk({ ok: true });
}
