import 'server-only';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole, type SessionUser } from '@/lib/auth/session';

/**
 * Every student page loads its data through this guard, so a student can only
 * ever read rows joined to their own StudentProfile.
 */
export async function requireStudent(): Promise<{ user: SessionUser; studentProfileId: string }> {
  const user = await requireRole('STUDENT');
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, onboardingCompletedAt: true },
  });
  if (!profile) redirect('/onboarding/student/education');
  return { user, studentProfileId: profile.id };
}

/** As above, but also forces onboarding to be finished first. */
export async function requireOnboardedStudent(): Promise<{ user: SessionUser; studentProfileId: string }> {
  const user = await requireRole('STUDENT');
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, onboardingCompletedAt: true, onboardingStep: true },
  });
  if (!profile) redirect('/onboarding/student/education');
  if (!profile.onboardingCompletedAt) redirect(`/onboarding/student/${profile.onboardingStep}`);
  return { user, studentProfileId: profile.id };
}

/**
 * Corporate scope. Returns the organisationId that every corporate query must
 * be filtered by — this is what stops one funder reading another's applicants.
 */
export async function requireCorporate(): Promise<{
  user: SessionUser;
  corporateProfileId: string;
  organisationId: string;
}> {
  const user = await requireRole('CORPORATE');
  const profile = await prisma.corporateProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, organisationId: true, onboardingCompletedAt: true, onboardingStep: true },
  });
  if (!profile) redirect('/register/organisation');
  if (!profile.onboardingCompletedAt) redirect(`/onboarding/organisation/${profile.onboardingStep}`);
  return { user, corporateProfileId: profile.id, organisationId: profile.organisationId };
}

/**
 * Administrator scope.
 *
 * Administrators have no profile table and no onboarding, so unlike the other
 * two guards there is no second lookup and nothing to redirect to mid-flow.
 * The returned id is the actor recorded against every admin action in the
 * audit log.
 */
export async function requireAdmin(): Promise<{ user: SessionUser; adminUserId: string }> {
  const user = await requireRole('ADMIN');
  return { user, adminUserId: user.id };
}
