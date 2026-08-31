import 'server-only';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole, type SessionUser } from '@/lib/auth/session';

/**
 * Guard for the corporate onboarding steps.
 *
 * Unlike `requireCorporate`, this does NOT insist onboarding is finished —
 * these are the pages where it gets finished.
 */
export async function requireCorporateOnboarding(): Promise<{
  user: SessionUser;
  corporateProfileId: string;
  organisationId: string;
}> {
  const user = await requireRole('CORPORATE');
  const profile = await prisma.corporateProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, organisationId: true },
  });
  if (!profile) redirect('/register/organisation');
  return { user, corporateProfileId: profile.id, organisationId: profile.organisationId };
}
