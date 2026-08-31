import 'server-only';
import { NextResponse } from 'next/server';
import type { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUser, type SessionUser } from '@/lib/auth/session';

/** Shape returned by every failed API call, so the client can render it. */
export type ApiError = { error: string; fields?: Record<string, string> };

export function apiError(message: string, status = 400, fields?: Record<string, string>) {
  return NextResponse.json<ApiError>({ error: message, ...(fields ? { fields } : {}) }, { status });
}

export function apiOk<T extends object>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Route-handler equivalent of requireUser — returns 401 rather than redirecting. */
export async function apiUser(role?: UserRole): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: apiError('You need to sign in to continue.', 401) };
  if (role && user.role !== role) {
    return { ok: false, response: apiError('You do not have access to this resource.', 403) };
  }
  return { ok: true, user };
}

export async function apiStudent(): Promise<
  { ok: true; user: SessionUser; studentProfileId: string } | { ok: false; response: NextResponse }
> {
  const auth = await apiUser('STUDENT');
  if (!auth.ok) return auth;
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: auth.user.id },
    select: { id: true },
  });
  if (!profile) return { ok: false, response: apiError('Student profile not found.', 404) };
  return { ok: true, user: auth.user, studentProfileId: profile.id };
}

export async function apiCorporate(): Promise<
  | { ok: true; user: SessionUser; organisationId: string; corporateProfileId: string }
  | { ok: false; response: NextResponse }
> {
  const auth = await apiUser('CORPORATE');
  if (!auth.ok) return auth;
  const profile = await prisma.corporateProfile.findUnique({
    where: { userId: auth.user.id },
    select: { id: true, organisationId: true },
  });
  if (!profile) return { ok: false, response: apiError('Organisation profile not found.', 404) };
  return {
    ok: true,
    user: auth.user,
    organisationId: profile.organisationId,
    corporateProfileId: profile.id,
  };
}

/** Turn a ZodError into the `fields` map our forms render inline. */
export function zodFields(error: { issues: { path: (string | number)[]; message: string }[] }) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
