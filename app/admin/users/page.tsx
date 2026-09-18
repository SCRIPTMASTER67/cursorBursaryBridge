import { PageBody } from '@/components/layout/app-shell';
import Link from 'next/link';
import type { AccountStatus, UserRole } from '@prisma/client';
import { Badge, Card, EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/guards';
import { listUsers } from '@/services/admin-users';

export const metadata = { title: 'Accounts · Bursary-Bridge admin' };

const ROLES: UserRole[] = ['STUDENT', 'CORPORATE', 'ADMIN'];
const STATUSES: AccountStatus[] = ['ACTIVE', 'SUSPENDED'];

function isRole(value?: string): value is UserRole {
  return !!value && (ROLES as string[]).includes(value);
}
function isStatus(value?: string): value is AccountStatus {
  return !!value && (STATUSES as string[]).includes(value);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const { rows, total, page, pageSize } = await listUsers({
    query: params.q,
    role: isRole(params.role) ? params.role : undefined,
    status: isStatus(params.status) ? params.status : undefined,
    page: Number(params.page) || 1,
  });

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageBody>
      <div className="space-y-6">
        <header>
          <h1 className="text-ink-900 text-[26px] font-semibold">Accounts</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            {total} account{total === 1 ? '' : 's'}. This screen shows account details only; a
            student&apos;s documents and a funder&apos;s applicant data stay governed by their own
            access rules.
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
                placeholder="Name or email address"
                className="mt-1.5 w-full rounded-field border border-line px-3 py-2 text-[14px]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-700" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue={params.role ?? ''}
                className="mt-1.5 rounded-field border border-line px-3 py-2 text-[14px]"
              >
                <option value="">All</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
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
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
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
          <EmptyState title="No accounts match" description="Try a different search or filter." />
        ) : (
          <Card className="p-0">
            {/* Wide content scrolls inside its own container rather than pushing the page sideways. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-ink-400">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Organisation</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users/${row.id}`}
                          className="text-primary-700 font-medium hover:underline"
                        >
                          {row.firstName} {row.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{row.email}</td>
                      <td className="px-4 py-3 text-ink-600">{row.role}</td>
                      <td className="px-4 py-3 text-ink-600">{row.organisationName ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={row.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-500">
                        {row.createdAt.toLocaleDateString('en-ZA')}
                      </td>
                    </tr>
                  ))}
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
