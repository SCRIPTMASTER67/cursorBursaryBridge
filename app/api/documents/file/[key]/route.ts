import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiUser } from '@/lib/auth/api';
import { storage } from '@/lib/storage';

/**
 * Authorised document download.
 *
 * Uploads live outside `public/`, so this handler is the only way to read one.
 * A document may be fetched by the student who owns it, or by a corporate user
 * whose organisation has received an application it is attached to.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  const { key: encodedKey } = await params;
  const storageKey = decodeURIComponent(encodedKey);

  const document = await prisma.document.findUnique({
    where: { storageKey },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      studentProfile: { select: { userId: true } },
      applications: { select: { application: { select: { organisationId: true } } } },
    },
  });

  if (!document) return apiError('Document not found.', 404);

  let allowed = false;

  if (auth.user.role === 'STUDENT') {
    allowed = document.studentProfile.userId === auth.user.id;
  } else {
    const profile = await prisma.corporateProfile.findUnique({
      where: { userId: auth.user.id },
      select: { organisationId: true },
    });
    allowed = Boolean(
      profile &&
        document.applications.some((link) => link.application.organisationId === profile.organisationId),
    );
  }

  if (!allowed) return apiError('You do not have access to this document.', 403);

  const object = await storage().get(storageKey);
  if (!object) return apiError('That file is no longer available.', 404);

  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      'Content-Type': document.mimeType || object.contentType,
      'Content-Disposition': `inline; filename="${document.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
