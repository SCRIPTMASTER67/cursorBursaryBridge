import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiAdmin, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { audit } from '@/services/audit';
import { restoreProgrammeSchema, unpublishProgrammeSchema } from '@/lib/validation/admin';

const actionSchema = z.object({
  action: z.enum(['SUSPEND', 'RESTORE']),
  reason: z.string(),
});

/**
 * Withdraw a programme that breaches policy, or restore one.
 *
 * Suspension sets ProgrammeStatus.SUSPENDED rather than DRAFT. That matters:
 * the owning organisation can publish a draft again at any time, so unpublishing
 * to DRAFT would let the funder undo the administrator's decision. Only this
 * endpoint can clear SUSPENDED.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiAdmin();
  if (!auth.ok) return auth.response;

  const ip = clientIp(request);
  const limit = rateLimit(`admin:programme-action:${auth.adminUserId}`, 30, 300);
  if (!limit.allowed) {
    return apiError(`Too many changes. Try again in ${limit.retryAfterSeconds} seconds.`, 429);
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid request.', 422, zodFields(parsed.error));

  const shape =
    parsed.data.action === 'SUSPEND' ? unpublishProgrammeSchema : restoreProgrammeSchema;
  const reasonParsed = shape.safeParse({ reason: parsed.data.reason });
  if (!reasonParsed.success) {
    return apiError('Please give a reason.', 422, zodFields(reasonParsed.error));
  }
  const { reason } = reasonParsed.data;

  const programme = await prisma.fundingProgramme.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      organisation: { select: { id: true, name: true } },
    },
  });
  if (!programme) return apiError('Programme not found.', 404);

  if (parsed.data.action === 'SUSPEND') {
    if (programme.status === 'SUSPENDED')
      return apiError('That programme is already suspended.', 422);
    await prisma.fundingProgramme.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await audit({
      userId: auth.adminUserId,
      action: 'admin.programme_suspended',
      entityType: 'FundingProgramme',
      entityId: id,
      metadata: {
        reason,
        programmeName: programme.name,
        organisationId: programme.organisation.id,
        organisationName: programme.organisation.name,
        previousStatus: programme.status,
      },
      ipAddress: ip,
    });
    return apiOk({ ok: true, status: 'SUSPENDED' });
  }

  if (programme.status !== 'SUSPENDED') return apiError('That programme is not suspended.', 422);

  // Restored to DRAFT rather than PUBLISHED, so the organisation reviews and
  // republishes it deliberately rather than it reappearing to students silently.
  await prisma.fundingProgramme.update({ where: { id }, data: { status: 'DRAFT' } });
  await audit({
    userId: auth.adminUserId,
    action: 'admin.programme_restored',
    entityType: 'FundingProgramme',
    entityId: id,
    metadata: { reason, programmeName: programme.name, restoredTo: 'DRAFT' },
    ipAddress: ip,
  });
  return apiOk({ ok: true, status: 'DRAFT' });
}
