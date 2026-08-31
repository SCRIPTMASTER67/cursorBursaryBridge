import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiCorporate, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { notify } from '@/services/notifications';
import { audit } from '@/services/audit';

const bulkSchema = z.object({
  applicationIds: z.array(z.string().cuid()).min(1, 'Select at least one applicant').max(200),
  action: z.enum(['SHORTLIST', 'SELECT', 'REMOVE']),
});

/**
 * Bulk shortlist actions.
 *
 * Every id is re-checked against the caller's organisation before anything is
 * written — the browser's list is never trusted.
 */
export async function POST(request: NextRequest) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    const fields = zodFields(parsed.error);
    return apiError(fields.applicationIds ?? 'Invalid request.', 422, fields);
  }

  const { applicationIds, action } = parsed.data;

  const applications = await prisma.application.findMany({
    where: { id: { in: applicationIds }, organisationId: auth.organisationId },
    select: {
      id: true,
      fundingProgrammeId: true,
      studentProfile: { select: { userId: true } },
      fundingProgramme: { select: { name: true } },
    },
  });

  if (applications.length === 0) {
    return apiError('None of those applicants belong to your organisation.', 403);
  }

  const now = new Date();

  if (action === 'REMOVE') {
    await prisma.$transaction([
      prisma.shortlist.deleteMany({
        where: { applicationId: { in: applications.map((a) => a.id) }, organisationId: auth.organisationId },
      }),
      prisma.application.updateMany({
        where: { id: { in: applications.map((a) => a.id) }, organisationId: auth.organisationId },
        data: { status: 'UNDER_REVIEW', lastStatusChangeAt: now },
      }),
    ]);
    await audit({
      userId: auth.user.id,
      action: 'shortlist.removed',
      entityType: 'Shortlist',
      metadata: { count: applications.length },
    });
    return apiOk({ ok: true, affected: applications.length });
  }

  const shortlistStatus = action === 'SELECT' ? 'SELECTED' : 'SHORTLISTED';
  const applicationStatus = action === 'SELECT' ? 'APPROVED' : 'SHORTLISTED';

  await prisma.$transaction(async (tx) => {
    for (const application of applications) {
      await tx.shortlist.upsert({
        where: { applicationId: application.id },
        create: {
          organisationId: auth.organisationId,
          fundingProgrammeId: application.fundingProgrammeId,
          applicationId: application.id,
          addedById: auth.user.id,
          status: shortlistStatus,
          selectedAt: action === 'SELECT' ? now : null,
        },
        update: { status: shortlistStatus, selectedAt: action === 'SELECT' ? now : null },
      });
    }

    await tx.application.updateMany({
      where: { id: { in: applications.map((a) => a.id) }, organisationId: auth.organisationId },
      data: {
        status: applicationStatus,
        lastStatusChangeAt: now,
        decisionAt: action === 'SELECT' ? now : null,
      },
    });
  });

  for (const application of applications) {
    await notify({
      userId: application.studentProfile.userId,
      type: 'APPLICATION_STATUS_CHANGED',
      title: action === 'SELECT' ? 'Your application was approved' : 'You have been shortlisted',
      body:
        action === 'SELECT'
          ? `Congratulations! Your application to ${application.fundingProgramme.name} has been approved.`
          : `Good news — you have been shortlisted for ${application.fundingProgramme.name}.`,
      link: `/student/applications/${application.id}`,
    });
  }

  await audit({
    userId: auth.user.id,
    action: action === 'SELECT' ? 'shortlist.selected' : 'shortlist.added',
    entityType: 'Shortlist',
    metadata: { count: applications.length },
  });

  return apiOk({ ok: true, affected: applications.length });
}
