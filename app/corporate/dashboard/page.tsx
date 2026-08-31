import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody } from '@/components/layout/app-shell';
import { ProgrammeStatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress';
import { Award, Calendar, Clock, Plus } from '@/components/icons';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { deadlineLabel, formatDate, formatNumber, greeting } from '@/lib/utils';
import { getCorporateStats, getProgrammeSummaries, getRecentActivity } from '@/services/corporate-stats';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function CorporateDashboardPage() {
  const { user, organisationId } = await requireCorporate();

  const [organisation, stats, programmes, activity] = await Promise.all([
    prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { name: true },
    }),
    getCorporateStats(organisationId),
    getProgrammeSummaries(organisationId),
    getRecentActivity(organisationId),
  ]);

  const activeProgrammes = programmes.filter((p) => p.status === 'PUBLISHED');
  const upcoming = activeProgrammes
    .filter((p) => p.closingDate.getTime() >= Date.now())
    .sort((a, b) => a.closingDate.getTime() - b.closingDate.getTime())
    .slice(0, 3);

  return (
    <PageBody>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">
            {greeting()}, {user.firstName}!
          </h1>
          <p className="mt-1.5 text-[13px] text-ink-400">
            Here’s what’s happening with your programmes at {organisation.name}.
          </p>
        </div>
        <ButtonLink href="/corporate/programmes/new" leadingIcon={<Plus className="h-4 w-4" />}>
          Create New Programme
        </ButtonLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard value={stats.activeProgrammes} label="Active Programmes" />
        <StatCard value={formatNumber(stats.totalApplications)} label="Total Applications" accent="info" />
        <StatCard value={formatNumber(stats.eligibleApplications)} label="Eligible Applicants" accent="success" />
        <StatCard value={formatNumber(stats.shortlisted)} label="Shortlisted" accent="warning" />
        <StatCard value={formatNumber(stats.selected)} label="Selected" accent="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* ------------------------------------------------ Active programmes */}
        <Card>
          <CardHeader
            title="Active programmes"
            description="Application volume and eligibility at a glance."
            action={
              <Link
                href="/corporate/programmes"
                className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
              >
                View all
              </Link>
            }
          />

          {activeProgrammes.length === 0 ? (
            <EmptyState
              icon={<Award className="h-5 w-5" />}
              title="No active programmes yet"
              description="Create a funding programme and define who is eligible. Students matching your criteria will see it straight away."
              action={
                <ButtonLink href="/corporate/programmes/new" leadingIcon={<Plus className="h-4 w-4" />}>
                  Create New Programme
                </ButtonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {activeProgrammes.slice(0, 5).map((programme) => {
                const eligibilityRate =
                  programme.applicationCount > 0
                    ? Math.round((programme.eligibleCount / programme.applicationCount) * 100)
                    : 0;
                return (
                  <li key={programme.id}>
                    <Link
                      href={`/corporate/programmes/${programme.id}`}
                      className="block px-6 py-4 transition-colors hover:bg-surface-subtle"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-ink">{programme.name}</p>
                          <p className="mt-0.5 text-xs text-ink-400">
                            {formatNumber(programme.applicationCount)} applications
                            <span className="mx-1.5">·</span>
                            Closes {formatDate(programme.closingDate)}
                          </p>
                        </div>
                        <ProgrammeStatusBadge status={programme.status} />
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar
                          value={eligibilityRate}
                          tone={eligibilityRate >= 70 ? 'success' : 'brand'}
                          className="flex-1"
                        />
                        <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-600">
                          {eligibilityRate}% eligible
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ---------------------------------------- Deadlines & recent activity */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Upcoming deadlines" />
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="No deadlines coming up"
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {upcoming.map((programme) => (
                  <li key={programme.id} className="flex items-start justify-between gap-3 px-6 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{programme.name}</p>
                      <p className="mt-0.5 text-xs text-ink-400">{formatDate(programme.closingDate)}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-warning-600">
                      {deadlineLabel(programme.closingDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent activity" />
            {activity.length === 0 ? (
              <EmptyState icon={<Clock className="h-5 w-5" />} title="Nothing yet" className="py-10" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {activity.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 px-6 py-3.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{event.label}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-400">
                        {event.detail}
                        <span className="mx-1.5">·</span>
                        {formatDate(event.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
