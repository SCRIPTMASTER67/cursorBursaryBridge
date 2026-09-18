import { PageBody } from '@/components/layout/app-shell';
import Link from 'next/link';
import type { ProgrammeStatus } from '@prisma/client';
import { Card, EmptyState } from '@/components/ui';
import { ProgrammeStatusBadge } from '@/components/ui/badge';
import { ReasonAction } from '@/components/admin/reason-action';
import { requireAdmin } from '@/lib/auth/guards';
import { listAllProgrammes } from '@/services/admin-programmes';

export const metadata = { title: 'Programmes · Bursary-Bridge admin' };

const STATUSES: ProgrammeStatus[] = ['DRAFT', 'PUBLISHED', 'CLOSED', 'SUSPENDED'];

export default async function AdminProgrammesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = (STATUSES as string[]).includes(params.status ?? '')
    ? (params.status as ProgrammeStatus)
    : undefined;

  const { rows, total } = await listAllProgrammes({
    query: params.q,
    status,
    page: Number(params.page) || 1,
  });

  return (
    <PageBody>
      <div className="space-y-6">
        <header>
          <h1 className="text-ink-900 text-[26px] font-semibold">Funding programmes</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            {total} programme{total === 1 ? '' : 's'} across every organisation. Suspending a
            programme withdraws it from students, and only an administrator can restore it.
          </p>
        </header>

        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-0 flex-1">
              <label className="block text-[13px] font-medium text-ink-700" htmlFor="q">
                Search
              </label>
              <input
                id="q"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Programme or organisation name"
                className="mt-1.5 w-full rounded-field border border-line px-3 py-2 text-[14px]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-700" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={params.status ?? ''}
                className="mt-1.5 rounded-field border border-line px-3 py-2 text-[14px]"
              >
                <option value="">All</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-primary-600 rounded-field px-4 py-2 text-[14px] font-medium text-white"
            >
              Apply
            </button>
          </form>
        </Card>

        {rows.length === 0 ? (
          <EmptyState title="No programmes match" description="Try a different search or filter." />
        ) : (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-ink-400">
                    <th className="px-4 py-3 font-semibold">Programme</th>
                    <th className="px-4 py-3 font-semibold">Organisation</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Closes</th>
                    <th className="px-4 py-3 text-right font-semibold">Applications</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line/60 last:border-0">
                      <td className="text-ink-800 px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/organisations/${row.organisation.id}`}
                          className="text-primary-700 hover:underline"
                        >
                          {row.organisation.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <ProgrammeStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {row.closingDate.toLocaleDateString('en-ZA')}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-700">
                        {row._count.applications}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.status === 'SUSPENDED' ? (
                          <ReasonAction
                            endpoint={`/api/admin/programmes/${row.id}`}
                            payload={{ action: 'RESTORE' }}
                            label="Restore"
                            title="Restore this programme"
                            description="It returns to draft so the organisation can review and publish it again."
                            confirmLabel="Restore to draft"
                            tone="primary"
                          />
                        ) : (
                          <ReasonAction
                            endpoint={`/api/admin/programmes/${row.id}`}
                            payload={{ action: 'SUSPEND' }}
                            label="Suspend"
                            title="Suspend this programme"
                            description="It is withdrawn from students immediately and the organisation cannot publish it again."
                            confirmLabel="Suspend"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </PageBody>
  );
}
