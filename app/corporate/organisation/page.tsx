import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { SummarySections } from '@/components/student/summary-sections';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/card';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { formatDate, formatNumber } from '@/lib/utils';
import { buildOrganisationSummary } from '@/services/organisation-summary';
import { getCorporateStats } from '@/services/corporate-stats';

export const metadata: Metadata = { title: 'Organisation' };

export default async function OrganisationPage() {
  const { organisationId, corporateProfileId } = await requireCorporate();

  const [sections, organisation, stats, members] = await Promise.all([
    buildOrganisationSummary(organisationId, corporateProfileId),
    prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { name: true, createdAt: true },
    }),
    getCorporateStats(organisationId),
    prisma.corporateProfile.findMany({
      where: { organisationId },
      select: {
        id: true,
        role: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
  ]);

  return (
    <PageBody>
      <PageHeader
        title={organisation.name}
        description={`On Bursary-Bridge since ${formatDate(organisation.createdAt)}`}
        actions={
          <ButtonLink href="/onboarding/organisation/details" variant="outline">
            Edit organisation
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard value={stats.activeProgrammes} label="Active programmes" />
        <StatCard value={formatNumber(stats.totalApplications)} label="Applications" accent="info" />
        <StatCard value={formatNumber(stats.shortlisted)} label="Shortlisted" accent="warning" />
        <StatCard value={formatNumber(stats.selected)} label="Beneficiaries" accent="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start [&>*]:min-w-0">
        <SummarySections sections={sections} />

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink">Users &amp; roles</h2>
          <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
            People who can manage this organisation’s programmes and applicants.
          </p>
          <ul className="mt-4 space-y-3">
            {members.map((member) => (
              <li key={member.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">
                    {member.user.firstName} {member.user.lastName}
                  </p>
                  <p className="truncate text-xs text-ink-400">{member.user.email}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageBody>
  );
}
