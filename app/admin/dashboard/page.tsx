import { PageBody } from '@/components/layout/app-shell';
import { Card } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminStats } from '@/services/admin-stats';
import { applicationStatusLabels } from '@/lib/labels';
import type { ApplicationStatus } from '@prisma/client';

export const metadata = { title: 'Admin dashboard · Bursary-Bridge' };

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-none text-ink-900">{value}</p>
      {hint ? <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p> : null}
    </Card>
  );
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getAdminStats();

  return (
    <PageBody>
      <div className="space-y-6">
        <header>
          <h1 className="text-[26px] font-semibold text-ink-900">Platform overview</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            Counts across the whole platform. Figures come from the stored records; nothing here
            recalculates a match score or an eligibility verdict.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
          <Stat
            label="Students"
            value={stats.students}
            hint={
              stats.suspendedStudents ? `${stats.suspendedStudents} suspended` : 'none suspended'
            }
          />
          <Stat
            label="Organisations"
            value={stats.organisations}
            hint={
              stats.suspendedOrganisations
                ? `${stats.suspendedOrganisations} suspended`
                : 'none suspended'
            }
          />
          <Stat label="Corporate users" value={stats.corporateUsers} />
          <Stat label="Sign-ups this week" value={stats.signupsThisWeek} hint="all roles" />
          <Stat
            label="Published programmes"
            value={stats.publishedProgrammes}
            hint={
              stats.suspendedProgrammes
                ? `${stats.suspendedProgrammes} suspended by an administrator`
                : 'none suspended'
            }
          />
        </div>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink-900">Applications by status</h2>
          {stats.applicationsByStatus.length === 0 ? (
            <p className="mt-2 text-[14px] text-ink-500">No applications yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-ink-400">
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Applications</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.applicationsByStatus.map((row) => (
                    <tr key={row.status} className="border-b border-line/60 last:border-0">
                      <td className="py-2 text-ink-700">
                        {applicationStatusLabels[row.status as ApplicationStatus] ?? row.status}
                      </td>
                      <td className="py-2 text-right font-medium text-ink-900">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageBody>
  );
}
