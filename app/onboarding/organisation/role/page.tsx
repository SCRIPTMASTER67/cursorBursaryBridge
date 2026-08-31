import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireCorporateOnboarding } from '@/lib/auth/corporate-onboarding';
import { CorporateRoleForm } from './role-form';

export const metadata: Metadata = { title: 'Your role' };

export default async function CorporateRolePage() {
  const { corporateProfileId } = await requireCorporateOnboarding();
  const profile = await prisma.corporateProfile.findUniqueOrThrow({
    where: { id: corporateProfileId },
    select: { role: true, organisationSize: true, department: true },
  });

  return (
    <CorporateRoleForm
      initial={{
        role: profile.role,
        organisationSize: profile.organisationSize,
        department: profile.department ?? '',
      }}
    />
  );
}
