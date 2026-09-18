import { PageBody } from '@/components/layout/app-shell';
import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/guards';
import { listOrganisations } from '@/services/admin-organisations';

export const metadata = { title: 'Organisations · Bursary-Bridge admin' };

export default async function AdminOrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status =
    params.status === 'ACTIVE' || params.status === 'SUSPENDED' ? params.status : undefined;

  const { rows, total } = await listOrganisations({
    query: params.q,
    status,
    page: Number(params.page) || 1,
  });

  return (
    <PageBody>
      <div className="space-y-6">
        <header>
          <h1 className="text-ink-900 text-[26px] font-semibold">Organisations</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            {total} organisation{total === 1 ? '' : 's'}. Organisations publish programmes
            themselves; suspension is the only status control here.
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
                placeholder="Organisation name"
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
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
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
          <EmptyState
            title="No organisations match"
            description="Try a different search or filter."
          />
        ) : (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-ink-400">
                    <th className="px-4 py-3 font-semibold">Organisation</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Programmes</th>
                    <th className="px-4 py-3 text-right font-semibold">Members</th>
                    <th className="px-4 py-3 text-right font-semibold">Applications</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/organisations/${row.id}`}
                          className="text-primary-700 font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{row.type}</td>
                      <td className="px-4 py-3">
                        <Badge tone={row.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-ink-700">{row._count.programmes}</td>
                      <td className="px-4 py-3 text-right text-ink-700">{row._count.members}</td>
                      <td className="px-4 py-3 text-right text-ink-700">
                        {row._count.applications}
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
