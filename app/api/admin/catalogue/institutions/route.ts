import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { InstitutionType, Province } from '@prisma/client';
import { apiAdmin, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { clientIp } from '@/lib/auth/rate-limit';
import { audit } from '@/services/audit';
import { catalogueStatusSchema, institutionSchema } from '@/lib/validation/admin';
import { createInstitution, setInstitutionStatus, updateInstitution } from '@/services/catalogue';

/**
 * Institution catalogue.
 *
 * Entries are retired, not deleted. Study preferences, current-institution
 * records and funder eligibility rules all point at these rows; removing one
 * would rewrite records of choices students actually made. SET_STATUS replaces
 * the old DELETE for that reason.
 *
 * Duplicate prevention lives in the catalogue service, which compares
 * canonical names — so "University of Johannesburg " cannot become a second
 * University of Johannesburg.
 */
const writeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE'), data: institutionSchema }),
  z.object({ action: z.literal('UPDATE'), id: z.string().cuid(), data: institutionSchema }),
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
    const result = await setInstitutionStatus(parsed.data.id, parsed.data.data.status);
    await audit({
      userId: auth.adminUserId,
      action: `admin.institution_${parsed.data.data.status.toLowerCase()}`,
      entityType: 'Institution',
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

  const { name, shortName, type, province, city, website, code } = parsed.data.data;
  const input = {
    name,
    shortName: shortName || null,
    type: type as InstitutionType,
    province: province as Province,
    city,
    website: website || null,
    code: code || null,
  };

  const result =
    parsed.data.action === 'CREATE'
      ? await createInstitution(input)
      : await updateInstitution(parsed.data.id, input);

  // A duplicate is reported against the name field, so the message appears
  // beside what the person typed rather than as a banner.
  if (!result.ok) return apiError(result.reason, 409, { 'data.name': result.reason });

  await audit({
    userId: auth.adminUserId,
    action:
      parsed.data.action === 'CREATE' ? 'admin.institution_created' : 'admin.institution_updated',
    entityType: 'Institution',
    entityId: result.value.id,
    metadata: { name: result.value.name },
    ipAddress: ip,
  });

  return apiOk({ ok: true, id: result.value.id }, parsed.data.action === 'CREATE' ? 201 : 200);
}
