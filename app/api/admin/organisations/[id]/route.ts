import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiAdmin, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { destroyAllSessions } from '@/lib/auth/session';
import { audit } from '@/services/audit';
import { reactivateAccountSchema, suspendAccountSchema } from '@/lib/validation/admin';

const actionSchema = z.object({
  action: z.enum(['SUSPEND', 'REACTIVATE']),
  reason: z.string(),
});

/**
 * Suspend or reactivate an organisation.
 *
 * Suspending an organisation also suspends its members and suspends its
 * published programmes, because leaving either running would mean a suspended
 * funder still collecting applications. Programmes that were already closed or
 * still in draft are left alone.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiAdmin();
  if (!auth.ok) return auth.response;

  const ip = clientIp(request);
  const limit = rateLimit(`admin:org-action:${auth.adminUserId}`, 30, 300);
  if (!limit.allowed) {
    return apiError(`Too many changes. Try again in ${limit.retryAfterSeconds} seconds.`, 429);
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid request.', 422, zodFields(parsed.error));

  const shape = parsed.data.action === 'SUSPEND' ? suspendAccountSchema : reactivateAccountSchema;
  const reasonParsed = shape.safeParse({ reason: parsed.data.reason });
  if (!reasonParsed.success) {
    return apiError('Please give a reason.', 422, zodFields(reasonParsed.error));
  }
  const { reason } = reasonParsed.data;

  const organisation = await prisma.organisation.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, members: { select: { userId: true } } },
  });
  if (!organisation) return apiError('Organisation not found.', 404);

  const memberIds = organisation.members.map((m) => m.userId);

  if (parsed.data.action === 'SUSPEND') {
    if (organisation.status === 'SUSPENDED') {
      return apiError('That organisation is already suspended.', 422);
    }
    await prisma.$transaction([
      prisma.organisation.update({ where: { id }, data: { status: 'SUSPENDED' } }),
      prisma.user.updateMany({ where: { id: { in: memberIds } }, data: { status: 'SUSPENDED' } }),
      prisma.fundingProgramme.updateMany({
        where: { organisationId: id, status: 'PUBLISHED' },
        data: { status: 'SUSPENDED' },
      }),
    ]);
    for (const userId of memberIds) await destroyAllSessions(userId);

    await audit({
      userId: auth.adminUserId,
      action: 'admin.organisation_suspended',
      entityType: 'Organisation',
      entityId: id,
      metadata: { reason, organisationName: organisation.name, membersSuspended: memberIds.length },
      ipAddress: ip,
    });
    return apiOk({ ok: true, status: 'SUSPENDED' });
  }

  if (organisation.status === 'ACTIVE')
    return apiError('That organisation is already active.', 422);

  // Reactivation restores the members, but not the programmes: a programme
  // suspended for its own breach must be restored deliberately, one at a time.
  await prisma.$transaction([
    prisma.organisation.update({ where: { id }, data: { status: 'ACTIVE' } }),
    prisma.user.updateMany({ where: { id: { in: memberIds } }, data: { status: 'ACTIVE' } }),
  ]);

  await audit({
    userId: auth.adminUserId,
    action: 'admin.organisation_reactivated',
    entityType: 'Organisation',
    entityId: id,
    metadata: { reason, organisationName: organisation.name, membersReactivated: memberIds.length },
    ipAddress: ip,
  });
  return apiOk({ ok: true, status: 'ACTIVE' });
}
