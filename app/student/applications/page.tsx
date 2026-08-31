import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ApplicationsList } from '@/components/student/applications-list';
import { ButtonLink } from '@/components/ui/button';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';

export const metadata: Metadata = { title: 'My Applications' };

export default async function ApplicationsPage() {
  const { studentProfileId } = await requireOnboardedStudent();

  // Scoped to this student's own profile — the only applications they may read.
  const applications = await prisma.application.findMany({
    where: { studentProfileId },
    include: {
      fundingProgramme: {
        select: {
          id: true,
          name: true,
          closingDate: true,
          organisation: { select: { name: true } },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  return (
    <PageBody>
      <PageHeader
        title="My Applications"
        description="Track every application you've started or submitted."
        actions={<ButtonLink href="/student/opportunities">Find opportunities</ButtonLink>}
      />
      <ApplicationsList
        applications={applications.map((application) => ({
          id: application.id,
          status: application.status,
          programmeName: application.fundingProgramme.name,
          organisationName: application.fundingProgramme.organisation.name,
          closingDate: application.fundingProgramme.closingDate.toISOString(),
          submittedAt: application.submittedAt?.toISOString() ?? null,
          lastUpdate: (application.lastStatusChangeAt ?? application.updatedAt).toISOString(),
          matchScore: application.matchScore,
        }))}
      />
    </PageBody>
  );
}
