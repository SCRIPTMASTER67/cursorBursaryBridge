import { PageBody } from '@/components/layout/app-shell';
import { Card, EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/guards';
import { auditFilterSchema } from '@/lib/validation/admin';
import { listAuditActions, searchAuditLog } from '@/services/admin-audit';

export const metadata = { title: 'Audit log · Bursary-Bridge admin' };

/**
 * Read-only audit trail.
 *
 * There is no edit or delete control on this page and no route behind it that
 * would allow one: the log is append-only, which is the property that makes it
 * worth keeping.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const parsed = auditFilterSchema.safeParse(params);
  const filter = parsed.success ? parsed.data : auditFilterSchema.parse({});

  const [{ rows, total, page, pageSize }, actions] = await Promise.all([
    searchAuditLog(filter),
    listAuditActions(),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageBody>
      <div className="space-y-6">
        <header>
          <h1 className="text-[26px] font-semibold text-ink-900">Audit log</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            {total} entr{total === 1 ? 'y' : 'ies'}. The log is append-only and read-only here.
          </p>
        </header>

        <Card className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 [&>*]:min-w-0" method="get">
            <div>
              <label className="block text-[13px] font-medium text-ink-700" htmlFor="actor">
                Actor
              </label>
              <input
                id="actor"
                name="actor"
                defaultValue={params.actor ?? ''}
                placeholder="Name or email"
                className="mt-1.5 w-full rounded-field border border-line px-3 py-2 text-[14px]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-700" htmlFor="action">
                Action
              </label>
              <input
                id="action"
                name="action"
                list="audit-actions"
                defaultValue={params.action ?? ''}
                placeholder="e.g. admin.user_suspended"
                className="mt-1.5 w-full rounded-field border border-line px-3 py-2 text-[14px]"
              />
              <datalist id="audit-actions">
                {actions.map((action) => (
                  <option key={action} value={action} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-700" htmlFor="entityType">
                Subject type
              </label>
              <input
                id="entityType"
                name="entityType"
                defaultValue={params.entityType ?? ''}
                placeholder="e.g. FundingProgramme"
                className="mt-1.5 w-full rounded-field border border-line px-3 py-2 text-[14px]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-700" htmlFor="from">
                From
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={params.from ?? ''}
                className="mt-1.5 w-full rounded-field border border-line px-3 py-2 text-[14px]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-700" htmlFor="to">
                To
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={params.to ?? ''}
                className="mt-1.5 w-full rounded-field border border-line px-3 py-2 text-[14px]"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <button
                type="submit"
                className="rounded-field bg-primary-600 px-4 py-2 text-[14px] font-medium text-white"
              >
                Apply filters
              </button>
            </div>
          </form>
        </Card>

        {rows.length === 0 ? (
          <EmptyState title="No entries match" description="Try widening the filters." />
        ) : (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-ink-400">
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Actor</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-4 py-3 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const meta = row.metadata as Record<string, unknown> | null;
                    const reason = meta && typeof meta.reason === 'string' ? meta.reason : null;
                    return (
                      <tr key={row.id} className="border-b border-line/60 last:border-0 align-top">
                        <td className="px-4 py-3 whitespace-nowrap text-ink-600">
                          {row.createdAt.toLocaleString('en-ZA')}
                        </td>
                        <td className="px-4 py-3 text-ink-700">
                          {row.user ? `${row.user.firstName} ${row.user.lastName}` : 'System'}
                          {row.user ? (
                            <span className="block text-[12px] text-ink-400">{row.user.email}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-medium text-ink-800">{row.action}</td>
                        <td className="px-4 py-3 text-ink-600">
                          {row.entityType}
                          {row.entityId ? (
                            <span className="block text-[12px] text-ink-400">{row.entityId}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-ink-600">{reason ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {pages > 1 ? (
          <p className="text-[13px] text-ink-500">
            Page {page} of {pages}
          </p>
        ) : null}
      </div>
    </PageBody>
  );
}
