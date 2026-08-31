import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { Card, CardHeader, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress';
import { Table, Td, Th, Tr } from '@/components/ui/table-exports';
import { BarChart } from '@/components/icons';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { applicationStatusLabels, provinceLabels } from '@/lib/labels';
import { formatNumber } from '@/lib/utils';
import { getCorporateStats, getProgrammeSummaries } from '@/services/corporate-stats';

export const metadata: Metadata = { title: 'Reports' };

/**
 * Pipeline reporting.
 *
 * Every figure is a grouped query against this organisation's own applications
 * — nothing is estimated or hard-coded.
 */
export default async function ReportsPage() {
  const { organisationId } = await requireCorporate();

  const [stats, programmes, byStatus, byProvince, byInstitution] = await Promise.all([
    getCorporateStats(organisationId),
    getProgrammeSummaries(organisationId),
    prisma.application.groupBy({
      by: ['status'],
      where: { organisationId, status: { not: 'DRAFT' } },
      _count: { _all: true },
    }),
    prisma.studentProfile.groupBy({
      by: ['province'],
      where: { applications: { some: { organisationId, status: { not: 'DRAFT' } } } },
      _count: { _all: true },
    }),
    prisma.studentProfile.groupBy({
      by: ['currentInstitutionId'],
      where: { applications: { some: { organisationId, status: { not: 'DRAFT' } } } },
      _count: { _all: true },
    }),
  ]);

  const institutionIds = byInstitution
    .map((row) => row.currentInstitutionId)
    .filter((id): id is string => id !== null);
  const institutions = await prisma.institution.findMany({
    where: { id: { in: institutionIds } },
    select: { id: true, name: true },
  });
  const institutionNames = new Map(institutions.map((i) => [i.id, i.name]));

  const totalApplications = byStatus.reduce((sum, row) => sum + row._count._all, 0);

  const topInstitutions = byInstitution
    .filter((row) => row.currentInstitutionId !== null)
    .map((row) => ({
      name: institutionNames.get(row.currentInstitutionId!) ?? 'Unknown',
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const provinces = byProvince
    .filter((row) => row.province !== null)
    .map((row) => ({ name: provinceLabels[row.province!], count: row._count._all }))
    .sort((a, b) => b.count - a.count);

  if (totalApplications === 0) {
    return (
      <PageBody>
        <PageHeader title="Reports" description="Pipeline and reach across your programmes." />
        <Card>
          <EmptyState
            icon={<BarChart className="h-5 w-5" />}
            title="No data to report yet"
            description="Once applications start arriving, you'll see your pipeline, reach and conversion here."
          />
        </Card>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader title="Reports" description="Pipeline and reach across your programmes." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard value={formatNumber(stats.totalApplications)} label="Total applications" accent="info" />
        <StatCard
          value={formatNumber(stats.eligibleApplications)}
          label="Eligible applicants"
          sublabel={`${Math.round((stats.eligibleApplications / Math.max(1, stats.totalApplications)) * 100)}% of applications`}
          accent="success"
        />
        <StatCard value={formatNumber(stats.shortlisted)} label="Shortlisted" accent="warning" />
        <StatCard
          value={formatNumber(stats.selected)}
          label="Selected"
          sublabel={`${Math.round((stats.selected / Math.max(1, stats.totalApplications)) * 100)}% conversion`}
          accent="success"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Applications by status" />
          <div className="space-y-3.5 px-6 pb-6">
            {byStatus
              .sort((a, b) => b._count._all - a._count._all)
              .map((row) => (
                <div key={row.status}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[13px] text-ink-600">{applicationStatusLabels[row.status]}</span>
                    <span className="text-[13px] font-semibold tabular-nums text-ink">
                      {formatNumber(row._count._all)}
                    </span>
                  </div>
                  <ProgressBar value={(row._count._all / totalApplications) * 100} />
                </div>
              ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Applicants by province" description="Where your applicants come from." />
          <div className="space-y-3.5 px-6 pb-6">
            {provinces.map((province) => (
              <div key={province.name}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[13px] text-ink-600">{province.name}</span>
                  <span className="text-[13px] font-semibold tabular-nums text-ink">
                    {formatNumber(province.count)}
                  </span>
                </div>
                <ProgressBar
                  value={(province.count / Math.max(...provinces.map((p) => p.count))) * 100}
                  tone="success"
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Programme performance" />
          <Table>
            <thead>
              <tr>
                <Th>Programme</Th>
                <Th align="right">Applications</Th>
                <Th align="right">Eligible</Th>
                <Th align="right">Shortlisted</Th>
                <Th align="right">Eligibility rate</Th>
              </tr>
            </thead>
            <tbody>
              {programmes.map((programme) => {
                const rate =
                  programme.applicationCount > 0
                    ? Math.round((programme.eligibleCount / programme.applicationCount) * 100)
                    : 0;
                return (
                  <Tr key={programme.id}>
                    <Td className="font-medium text-ink">{programme.name}</Td>
                    <Td align="right" className="tabular-nums">
                      {formatNumber(programme.applicationCount)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatNumber(programme.eligibleCount)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatNumber(programme.shortlistCount)}
                    </Td>
                    <Td align="right" className="tabular-nums font-semibold text-ink">
                      {rate}%
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Top institutions" description="Where your applicants are studying." />
          <Table>
            <thead>
              <tr>
                <Th>Institution</Th>
                <Th align="right">Applicants</Th>
                <Th align="right">Share</Th>
              </tr>
            </thead>
            <tbody>
              {topInstitutions.map((institution) => (
                <Tr key={institution.name}>
                  <Td className="font-medium text-ink">{institution.name}</Td>
                  <Td align="right" className="tabular-nums">
                    {formatNumber(institution.count)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {Math.round((institution.count / totalApplications) * 100)}%
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </PageBody>
  );
}
