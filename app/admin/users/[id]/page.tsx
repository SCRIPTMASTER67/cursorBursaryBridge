import { PageBody } from '@/components/layout/app-shell';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui';
import { ReasonAction } from '@/components/admin/reason-action';
import { requireAdmin } from '@/lib/auth/guards';
import { getUserDetail } from '@/services/admin-users';

export const metadata = { title: 'Account · Bursary-Bridge admin' };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-line/60 py-2 last:border-0">
      <span className="text-[13px] text-ink-500">{label}</span>
      <span className="text-[14px] text-ink-800">{value}</span>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { adminUserId } = await requireAdmin();
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();

  const isSelf = user.id === adminUserId;

  return (
    <PageBody>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/users" className="text-[13px] text-primary-700 hover:underline">
              ← Back to accounts
            </Link>
            <h1 className="mt-1 text-[26px] font-semibold text-ink-900">
              {user.firstName} {user.lastName}
            </h1>
            <p className="mt-1 text-[14px] text-ink-500">
              {user.email} · {user.role} ·{' '}
              <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>{user.status}</Badge>
            </p>
          </div>

          {isSelf ? (
            <p className="max-w-xs text-[13px] text-ink-500">
              This is your own account. Account actions are disabled on it, so an administrator
              cannot lock themselves out.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user.status === 'ACTIVE' ? (
                <ReasonAction
                  endpoint={`/api/admin/users/${user.id}`}
                  payload={{ action: 'SUSPEND' }}
                  label="Suspend account"
                  title="Suspend this account"
                  description="The account is signed out immediately and cannot sign in again until it is reactivated."
                  confirmLabel="Suspend"
                />
              ) : (
                <ReasonAction
                  endpoint={`/api/admin/users/${user.id}`}
                  payload={{ action: 'REACTIVATE' }}
                  label="Reactivate account"
                  title="Reactivate this account"
                  description="The account will be able to sign in again."
                  confirmLabel="Reactivate"
                  tone="primary"
                />
              )}
              <ReasonAction
                endpoint={`/api/admin/users/${user.id}`}
                payload={{ action: 'FORCE_PASSWORD_RESET' }}
                label="Force password reset"
                title="Force a password reset"
                description="Every session is ended and the account must set a new password before signing in."
                confirmLabel="Force reset"
                tone="primary"
              />
            </div>
          )}
        </header>

        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink-900">Account</h2>
            <div className="mt-3">
              <Row label="Mobile" value={user.mobile ?? '—'} />
              <Row
                label="Email verified"
                value={
                  user.emailVerifiedAt
                    ? user.emailVerifiedAt.toLocaleString('en-ZA')
                    : 'Not verified'
                }
              />
              <Row
                label="Last sign-in"
                value={user.lastLoginAt ? user.lastLoginAt.toLocaleString('en-ZA') : 'Never'}
              />
              <Row label="Joined" value={user.createdAt.toLocaleDateString('en-ZA')} />
              <Row label="Must reset password" value={user.mustResetPassword ? 'Yes' : 'No'} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink-900">Profile summary</h2>
            {user.studentProfile ? (
              <div className="mt-3">
                <Row label="Profile strength" value={`${user.studentProfile.profileStrength}%`} />
                <Row
                  label="Onboarding"
                  value={user.studentProfile.onboardingCompletedAt ? 'Complete' : 'In progress'}
                />
                <Row label="Province" value={user.studentProfile.province ?? '—'} />
                <Row label="City" value={user.studentProfile.city ?? '—'} />
                <Row
                  label="Study preferences"
                  value={user.studentProfile._count.studyPreferences}
                />
                <Row label="Applications" value={user.studentProfile._count.applications} />
                <Row label="Documents" value={user.studentProfile._count.documents} />
              </div>
            ) : user.corporateProfile ? (
              <div className="mt-3">
                <Row
                  label="Organisation"
                  value={
                    <Link
                      href={`/admin/organisations/${user.corporateProfile.organisation.id}`}
                      className="text-primary-700 hover:underline"
                    >
                      {user.corporateProfile.organisation.name}
                    </Link>
                  }
                />
                <Row
                  label="Organisation status"
                  value={user.corporateProfile.organisation.status}
                />
                <Row
                  label="Onboarding"
                  value={user.corporateProfile.onboardingCompletedAt ? 'Complete' : 'In progress'}
                />
              </div>
            ) : (
              <p className="mt-2 text-[14px] text-ink-500">
                This account has no student or organisation profile.
              </p>
            )}
            <p className="mt-4 text-[12px] text-ink-400">
              Counts only. Document contents and application answers are not readable from the admin
              portal.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink-900">Active sessions</h2>
            <p className="mt-1 text-[12px] text-ink-400">
              Sessions are deleted at sign-out and on expiry, so this is what the account holds now
              rather than a history. Sign-in history is in the activity list.
            </p>
            {user.sessions.length === 0 ? (
              <p className="mt-3 text-[14px] text-ink-500">No active sessions.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-ink-400">
                      <th className="pb-2 font-semibold">Started</th>
                      <th className="pb-2 font-semibold">Expires</th>
                      <th className="pb-2 font-semibold">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.sessions.map((session) => (
                      <tr key={session.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2 text-ink-700">
                          {session.createdAt.toLocaleString('en-ZA')}
                        </td>
                        <td className="py-2 text-ink-600">
                          {session.expiresAt.toLocaleDateString('en-ZA')}
                        </td>
                        <td className="py-2 text-ink-500">{session.ipAddress ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink-900">Recent activity</h2>
            {user.recentActivity.length === 0 ? (
              <p className="mt-3 text-[14px] text-ink-500">Nothing recorded.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {user.recentActivity.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap justify-between gap-2 text-[13px]">
                    <span className="text-ink-700">{entry.action}</span>
                    <span className="text-ink-400">{entry.createdAt.toLocaleString('en-ZA')}</span>
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
