import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, apiStudent } from '@/lib/auth/api';
import { audit } from '@/services/audit';

/** Withdraw a draft. Submitted applications cannot be deleted by the student. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Scoped to the caller's own profile, so one student can never delete another's.
  const application = await prisma.application.findFirst({
    where: { id, studentProfileId: auth.studentProfileId },
    select: { id: true, status: true },
  });

  if (!application) return apiError('Application not found.', 404);
  if (application.status !== 'DRAFT') {
    return apiError('A submitted application cannot be deleted. Contact the funder to withdraw it.', 409);
  }

  await prisma.application.delete({ where: { id: application.id } });
  await audit({
    userId: auth.user.id,
    action: 'application.draft_deleted',
    entityType: 'Application',
    entityId: application.id,
  });

  return apiOk({ ok: true, redirectTo: '/student/applications' });
}
