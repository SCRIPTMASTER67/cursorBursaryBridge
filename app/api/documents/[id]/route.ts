import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, apiStudent } from '@/lib/auth/api';
import { storage } from '@/lib/storage';
import { refreshProfileStrength } from '@/services/student-profile';
import { audit } from '@/services/audit';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, studentProfileId: auth.studentProfileId },
    select: { id: true, storageKey: true },
  });
  if (!document) return apiError('Document not found.', 404);

  await prisma.document.delete({ where: { id: document.id } });
  await storage().delete(document.storageKey);
  await refreshProfileStrength(auth.studentProfileId);
  await audit({
    userId: auth.user.id,
    action: 'document.deleted',
    entityType: 'Document',
    entityId: document.id,
  });

  return apiOk({ ok: true });
}
