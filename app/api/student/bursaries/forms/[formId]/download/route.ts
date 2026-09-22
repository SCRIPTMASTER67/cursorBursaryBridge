import { NextResponse } from 'next/server';
import { apiError, apiStudent } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';

/**
 * Serve a mirrored official application form.
 *
 * Forms are stored outside `public/`, so this handler is the only way to read
 * one. It is behind the student guard, it re-checks the file's hash against
 * what was recorded when it was mirrored, and it sends the file as an
 * attachment with a name the browser cannot be talked into re-interpreting.
 *
 * A form that was linked rather than mirrored is not served from here at all:
 * the student is sent to the funder's own site, which is where it belongs.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ formId: string }> }) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const { formId } = await params;
  const form = await prisma.applicationForm.findUnique({
    where: { id: formId },
    select: {
      name: true,
      fileType: true,
      storageKey: true,
      providedBy: true,
      fundingProgramme: { select: { status: true } },
    },
  });

  if (!form) return apiError('That form was not found.', 404);
  if (form.fundingProgramme.status === 'SUSPENDED') {
    return apiError('This opportunity is not currently available.', 404);
  }
  if (!form.storageKey) {
    return apiError('This form is hosted by the funder. Please download it from their site.', 409);
  }

  const object = await storage().get(form.storageKey);
  if (!object) return apiError('That file is no longer available.', 410);

  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      // Served as the stored type, never as the client asked for it.
      'Content-Type': form.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeFileName(form.name, form.fileType)}"`,
      // The file came from outside, so it is never allowed to run as a page.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}

/** A download name with nothing in it a shell or a browser can act on. */
function safeFileName(name: string, fileType: string): string {
  const base =
    name
      .replace(/[^A-Za-z0-9 ._-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^[.\-]+/, '')
      .slice(0, 80) || 'application-form';
  return base.toLowerCase().endsWith(`.${fileType}`) ? base : `${base}.${fileType}`;
}
