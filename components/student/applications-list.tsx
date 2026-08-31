'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ApplicationStatus } from '@prisma/client';
import { ApplicationStatusBadge, MatchBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { ClipboardList } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export type ApplicationRow = {
  id: string;
  status: ApplicationStatus;
  programmeName: string;
  organisationName: string;
  closingDate: string;
  submittedAt: string | null;
  lastUpdate: string;
  matchScore: number | null;
};

/** Grouped application tracking, mirroring the reference "My Applications". */
export function ApplicationsList({ applications }: { applications: ApplicationRow[] }) {
  const [tab, setTab] = useState('all');

  const counts = useMemo(
    () => ({
      all: applications.length,
      draft: applications.filter((a) => a.status === 'DRAFT').length,
      submitted: applications.filter((a) => a.status === 'SUBMITTED').length,
      review: applications.filter((a) => a.status === 'UNDER_REVIEW' || a.status === 'DOCUMENTS_REQUIRED')
        .length,
      shortlisted: applications.filter((a) => a.status === 'SHORTLISTED').length,
      decided: applications.filter((a) => a.status === 'APPROVED' || a.status === 'UNSUCCESSFUL').length,
    }),
    [applications],
  );

  const visible = applications.filter((application) => {
    if (tab === 'all') return true;
    if (tab === 'draft') return application.status === 'DRAFT';
    if (tab === 'submitted') return application.status === 'SUBMITTED';
    if (tab === 'review')
      return application.status === 'UNDER_REVIEW' || application.status === 'DOCUMENTS_REQUIRED';
    if (tab === 'shortlisted') return application.status === 'SHORTLISTED';
    return application.status === 'APPROVED' || application.status === 'UNSUCCESSFUL';
  });

  if (applications.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="You haven’t applied to anything yet"
          description="Browse the opportunities matched to your profile and apply — your details are filled in for you."
          action={<ButtonLink href="/student/opportunities">Browse opportunities</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <Card>
      <Tabs
        className="px-5 pt-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'draft', label: 'Drafts', count: counts.draft },
          { key: 'submitted', label: 'Submitted', count: counts.submitted },
          { key: 'review', label: 'In Review', count: counts.review },
          { key: 'shortlisted', label: 'Shortlisted', count: counts.shortlisted },
          { key: 'decided', label: 'Decided', count: counts.decided },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState title="Nothing here yet" description="No applications currently have this status." />
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((application) => (
            <li key={application.id}>
              <Link
                href={`/student/applications/${application.id}`}
                className="block px-5 py-4 transition-colors hover:bg-surface-subtle"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">{application.programmeName}</p>
                    <p className="mt-0.5 text-[13px] text-ink-400">{application.organisationName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {application.matchScore !== null && (
                      <MatchBadge score={application.matchScore} size="sm" />
                    )}
                    <ApplicationStatusBadge status={application.status} />
                  </div>
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1.5 text-[13px]">
                  <div className="flex gap-1.5">
                    <dt className="text-ink-400">
                      {application.status === 'DRAFT' ? 'Saved' : 'Applied'}
                    </dt>
                    <dd className="font-medium text-ink-600">
                      {formatDate(application.submittedAt ?? application.lastUpdate)}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-ink-400">Closes</dt>
                    <dd className="font-medium text-ink-600">{formatDate(application.closingDate)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-ink-400">Last update</dt>
                    <dd className="font-medium text-ink-600">{formatDate(application.lastUpdate)}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
