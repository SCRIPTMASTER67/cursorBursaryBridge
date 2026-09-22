import { PageBody } from '@/components/layout/app-shell';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui';
import { ProgrammeStatusBadge } from '@/components/ui/badge';
import { ReasonAction } from '@/components/admin/reason-action';
import { requireAdmin } from '@/lib/auth/guards';
import { getOrganisationDetail } from '@/services/admin-organisations';

export const metadata = { title: 'Organisation · Bursary-Bridge admin' };

export default async function AdminOrganisationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const organisation = await getOrganisationDetail(id);
  if (!organisation) notFound();

  return (
    <PageBody>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/organisations"
              className="text-primary-700 text-[13px] hover:underline"
            >
              ← Back to organisations
            </Link>
            <h1 className="text-ink-900 mt-1 text-[26px] font-semibold">{organisation.name}</h1>
            <p className="mt-1 text-[14px] text-ink-500">
              {organisation.type} ·{' '}
              <Badge tone={organisation.status === 'ACTIVE' ? 'success' : 'danger'}>
                {organisation.status}
              </Badge>
            </p>
          </div>
          {organisation.status === 'ACTIVE' ? (
            <ReasonAction
              endpoint={`/api/admin/organisations/${organisation.id}`}
              payload={{ action: 'SUSPEND' }}
              label="Suspend organisation"
              title="Suspend this organisation"
              description="Its members are signed out and suspended, and its published programmes are withdrawn from students."
              confirmLabel="Suspend"
            />
          ) : (
            <ReasonAction
              endpoint={`/api/admin/organisations/${organisation.id}`}
              payload={{ action: 'REACTIVATE' }}
              label="Reactivate organisation"
              title="Reactivate this organisation"
              description="Members can sign in again. Suspended programmes stay suspended and must be restored individually."
              confirmLabel="Reactivate"
              tone="primary"
            />
          )}
        </header>

        <Card className="p-5">
          <h2 className="text-ink-900 text-[15px] font-semibold">Funding programmes</h2>
          {organisation.programmes.length === 0 ? (
            <p className="mt-2 text-[14px] text-ink-500">No programmes yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-ink-400">
                    <th className="pb-2 font-semibold">Programme</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Closes</th>
                    <th className="pb-2 text-right font-semibold">Applications</th>
                  </tr>
                </thead>
                <tbody>
                  {organisation.programmes.map((programme) => (
                    <tr key={programme.id} className="border-b border-line/60 last:border-0">
                      <td className="text-ink-800 py-2">{programme.name}</td>
                      <td className="py-2">
                        <ProgrammeStatusBadge status={programme.status} />
                      </td>
                      <td className="py-2 text-ink-600">
                        {programme.closingDate?.toLocaleDateString('en-ZA') ?? 'No fixed deadline'}
                      </td>
                      <td className="py-2 text-right text-ink-700">
                        {programme._count.applications}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-ink-900 text-[15px] font-semibold">Members</h2>
          <ul className="mt-3 space-y-1.5">
            {organisation.members.map((member) => (
              <li key={member.id} className="flex flex-wrap justify-between gap-2 text-[14px]">
                <Link
                  href={`/admin/users/${member.user.id}`}
                  className="text-primary-700 hover:underline"
                >
                  {member.user.firstName} {member.user.lastName}
                </Link>
                <span className="text-ink-500">
                  {member.user.email} · {member.user.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageBody>
  );
}
