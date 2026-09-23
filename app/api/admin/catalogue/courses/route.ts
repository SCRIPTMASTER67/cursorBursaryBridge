import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { CareerInterest, QualificationLevel } from '@prisma/client';
import { apiAdmin, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { clientIp } from '@/lib/auth/rate-limit';
import { audit } from '@/services/audit';
import { catalogueStatusSchema, courseSchema } from '@/lib/validation/admin';
import { createProgramme, setProgrammeStatus, updateProgramme } from '@/services/catalogue';

/**
 * Course catalogue. A Programme here is a course of study, distinct from a
 * FundingProgramme.
 *
 * As with institutions, entries are retired rather than deleted, and a course
 * carries the institutions that actually offer it — the two are not
 * independent lists.
 */
const writeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE'), data: courseSchema }),
  z.object({ action: z.literal('UPDATE'), id: z.string().cuid(), data: courseSchema }),
  z.object({ action: z.literal('SET_STATUS'), id: z.string().cuid(), data: catalogueStatusSchema }),
]);

export async function POST(request: NextRequest) {
  const auth = await apiAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = writeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
  }
  const ip = clientIp(request);

  if (parsed.data.action === 'SET_STATUS') {
    const result = await setProgrammeStatus(parsed.data.id, parsed.data.data.status);
    await audit({
      userId: auth.adminUserId,
      action: `admin.course_${parsed.data.data.status.toLowerCase()}`,
      entityType: 'Programme',
      entityId: result.value.id,
      metadata: {
        name: result.value.name,
        studyPreferences: result.value._count.studyPreferences,
        currentStudents: result.value._count.currentStudents,
      },
      ipAddress: ip,
    });
    return apiOk({ ok: true, id: result.value.id, status: result.value.status });
  }

  const { name, field, qualificationLevels, code, institutionIds } = parsed.data.data;
  const input = {
    name,
    field: field as CareerInterest,
    qualificationLevels: qualificationLevels as QualificationLevel[],
    code: code || null,
    institutionIds,
  };

  const result =
    parsed.data.action === 'CREATE'
      ? await createProgramme(input)
      : await updateProgramme(parsed.data.id, input);

  if (!result.ok) return apiError(result.reason, 409, { 'data.name': result.reason });

  await audit({
    userId: auth.adminUserId,
    action: parsed.data.action === 'CREATE' ? 'admin.course_created' : 'admin.course_updated',
    entityType: 'Programme',
    entityId: result.value.id,
    metadata: { name: result.value.name, institutions: institutionIds?.length ?? 0 },
    ipAddress: ip,
  });

  return apiOk({ ok: true, id: result.value.id }, parsed.data.action === 'CREATE' ? 201 : 200);
}
