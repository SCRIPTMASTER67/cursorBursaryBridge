import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiCorporate, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { applicationDecisionSchema } from '@/lib/validation/application';
import { applicationStatusLabels } from '@/lib/labels';
import { notify } from '@/services/notifications';
import { audit } from '@/services/audit';

/**
 * Move an application through the review pipeline.
 *
 * Shortlisting and selecting also maintain the Shortlist table, so the
 * shortlist and beneficiary views stay consistent with application status.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Scoped to the caller's organisation.
  const application = await prisma.application.findFirst({
    where: { id, organisationId: auth.organisationId },
    select: {
      id: true,
      status: true,
      fundingProgrammeId: true,
      studentProfile: { select: { userId: true } },
      fundingProgramme: { select: { name: true, organisation: { select: { name: true } } } },
      shortlist: { select: { id: true } },
    },
  });
  if (!application) return apiError('Application not found.', 404);

  const body = await request.json().catch(() => null);
  const parsed = applicationDecisionSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid decision.', 422, zodFields(parsed.error));

  const { status, note } = parsed.data;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: {
        status,
        reviewNotes: note || null,
        lastStatusChangeAt: now,
        decisionAt: status === 'APPROVED' || status === 'UNSUCCESSFUL' ? now : null,
      },
    });

    if (status === 'SHORTLISTED' || status === 'APPROVED') {
      await tx.shortlist.upsert({
        where: { applicationId: application.id },
        create: {
          organisationId: auth.organisationId,
          fundingProgrammeId: application.fundingProgrammeId,
          applicationId: application.id,
          addedById: auth.user.id,
          status: status === 'APPROVED' ? 'SELECTED' : 'SHORTLISTED',
          selectedAt: status === 'APPROVED' ? now : null,
          note: note || null,
        },
        update: {
          status: status === 'APPROVED' ? 'SELECTED' : 'SHORTLISTED',
          selectedAt: status === 'APPROVED' ? now : null,
          note: note || null,
        },
      });
    } else if (application.shortlist) {
      // Moving back out of the shortlist should not leave a stale entry.
      await tx.shortlist.update({
        where: { applicationId: application.id },
        data: { status: 'WITHDRAWN' },
      });
    }
  });

  // Students are told about every status change except the internal move to
  // "under review", which carries no action for them.
  const studentFacing: Record<string, string> = {
    SHORTLISTED: `Good news — you have been shortlisted for ${application.fundingProgramme.name}.`,
    APPROVED: `Congratulations! Your application to ${application.fundingProgramme.name} has been approved.`,
    UNSUCCESSFUL: `Your application to ${application.fundingProgramme.name} was not successful this time.`,
    DOCUMENTS_REQUIRED: `${application.fundingProgramme.organisation.name} needs more information for your ${application.fundingProgramme.name} application.`,
  };

  if (studentFacing[status]) {
    await notify({
      userId: application.studentProfile.userId,
      type: status === 'DOCUMENTS_REQUIRED' ? 'INFORMATION_REQUESTED' : 'APPLICATION_STATUS_CHANGED',
      title: `Application ${applicationStatusLabels[status].toLowerCase()}`,
      body: note ? `${studentFacing[status]} ${note}` : studentFacing[status],
      link: `/student/applications/${application.id}`,
    });
  }

  await audit({
    userId: auth.user.id,
    action: `application.status_${status.toLowerCase()}`,
    entityType: 'Application',
    entityId: application.id,
    metadata: { from: application.status, to: status },
  });

  return apiOk({ ok: true, status });
}
