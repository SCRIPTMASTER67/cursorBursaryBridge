'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ApplicationStatus, EligibilityOutcome } from '@prisma/client';
import { ApplicationStatusBadge, EligibilityBadge, MatchBadge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Table, Td, Th, Tr } from '@/components/ui/table-exports';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { ClipboardList, Filter, Search, Star } from '@/components/icons';
import { qualificationLabels } from '@/lib/labels';
import { formatDate, formatNumber } from '@/lib/utils';

export type ApplicantTableRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  institution: string | null;
  programme: string | null;
  qualification: string | null;
  academicAverage: number | null;
  matchScore: number | null;
  eligibilityOutcome: EligibilityOutcome | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  programmeName: string;
  shortlisted: boolean;
};

/**
 * Applicant table with server-driven filters, paging and bulk shortlisting.
 * Filter state lives in the URL so a view can be shared or bookmarked.
 */
export function ApplicantsTable({
  rows,
  total,
  page,
  pageSize,
  counts,
  programmes,
  institutions,
  courses,
}: {
  rows: ApplicantTableRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: {
    total: number;
    eligible: number;
    inReview: number;
    shortlisted: number;
    selected: number;
    rejected: number;
  };
  programmes: { id: string; name: string }[];
  institutions: { id: string; name: string }[];
  courses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  function setParam(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, value);
    }
    // Any filter change resets to the first page.
    if (!('page' in updates)) params.delete('page');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
    setSelected([]);
  }

  const activeStatus = searchParams.get('status') ?? '';

  async function bulk(action: 'SHORTLIST' | 'SELECT' | 'REMOVE') {
    if (selected.length === 0) return;
    setBulkBusy(true);
    try {
      const response = await fetch('/api/corporate/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationIds: selected, action }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; affected?: number };

      if (!response.ok) {
        toast.push('error', payload.error ?? 'That action could not be completed.');
        return;
      }

      toast.push(
        'success',
        action === 'SELECT'
          ? `${payload.affected} applicant(s) moved to Selected.`
          : action === 'SHORTLIST'
            ? `${payload.affected} applicant(s) shortlisted.`
            : `${payload.affected} applicant(s) removed from the shortlist.`,
      );
      setSelected([]);
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));

  return (
    <Card>
      <Tabs
        className="px-5 pt-4"
        active={activeStatus || 'all'}
        onChange={(key) => setParam({ status: key === 'all' ? undefined : key })}
        tabs={[
          { key: 'all', label: 'All', count: counts.total },
          { key: 'SUBMITTED', label: 'Submitted' },
          { key: 'UNDER_REVIEW', label: 'In Review', count: counts.inReview },
          { key: 'SHORTLISTED', label: 'Shortlisted', count: counts.shortlisted },
          { key: 'APPROVED', label: 'Selected', count: counts.selected },
          { key: 'UNSUCCESSFUL', label: 'Rejected', count: counts.rejected },
        ]}
      />

      {/* ---------------------------------------------------------- Toolbar */}
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <form
            className="flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              setParam({ q: search || undefined });
            }}
          >
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search applicants by name or email"
              leadingIcon={<Search className="h-4 w-4" />}
              aria-label="Search applicants"
            />
          </form>

          <div className="flex gap-3">
            <Select
              options={[
                { value: '', label: 'All programmes' },
                ...programmes.map((p) => ({ value: p.id, label: p.name })),
              ]}
              value={searchParams.get('programme') ?? ''}
              onChange={(event) => setParam({ programme: event.target.value })}
              aria-label="Filter by programme"
              className="sm:w-[220px]"
            />
            <Button
              variant="outline"
              onClick={() => setShowFilters((s) => !s)}
              leadingIcon={<Filter className="h-4 w-4" />}
              aria-expanded={showFilters}
            >
              Filters
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Institution</span>
              <Select
                options={[
                  { value: '', label: 'All institutions' },
                  ...institutions.map((i) => ({ value: i.id, label: i.name })),
                ]}
                value={searchParams.get('institution') ?? ''}
                onChange={(event) => setParam({ institution: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Course</span>
              <Select
                options={[
                  { value: '', label: 'All courses' },
                  ...courses.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={searchParams.get('course') ?? ''}
                onChange={(event) => setParam({ course: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Eligibility</span>
              <Select
                options={[
                  { value: '', label: 'Any eligibility' },
                  { value: 'ELIGIBLE', label: 'Eligible' },
                  { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
                  { value: 'NOT_ELIGIBLE', label: 'Not eligible' },
                ]}
                value={searchParams.get('eligibility') ?? ''}
                onChange={(event) => setParam({ eligibility: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Match score</span>
              <Select
                options={[
                  { value: '', label: 'Any score' },
                  { value: '85', label: '85% and above' },
                  { value: '70', label: '70% and above' },
                  { value: '60', label: '60% and above' },
                ]}
                value={searchParams.get('match') ?? ''}
                onChange={(event) => setParam({ match: event.target.value })}
              />
            </label>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ Bulk actions */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-brand-50/60 px-5 py-3">
          <p className="text-[13px] font-medium text-ink">
            {selected.length} applicant{selected.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelected([])}
              disabled={bulkBusy}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulk('REMOVE')}
              loading={bulkBusy}
            >
              Remove from shortlist
            </Button>
            <Button
              size="sm"
              leadingIcon={<Star className="h-3.5 w-3.5" />}
              onClick={() => bulk('SHORTLIST')}
              loading={bulkBusy}
            >
              Add to Shortlist
            </Button>
            <Button size="sm" variant="success" onClick={() => bulk('SELECT')} loading={bulkBusy}>
              Move to Selected
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No applications match this view"
          description="Try a different programme, status or filter combination."
        />
      ) : (
        <>
          <div className={pending ? 'opacity-60 transition-opacity' : undefined}>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all applicants on this page"
                      checked={allVisibleSelected}
                      onChange={(event) =>
                        setSelected(event.target.checked ? rows.map((row) => row.id) : [])
                      }
                      className="h-[18px] w-[18px] cursor-pointer rounded-[5px] border-line-strong text-brand-600 focus:ring-brand-600"
                    />
                  </Th>
                  <Th>Applicant</Th>
                  <Th align="right">Match %</Th>
                  <Th align="right">Average</Th>
                  <Th>Eligibility</Th>
                  <Th>Status</Th>
                  <Th>Date Applied</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const [firstName, ...rest] = row.studentName.split(' ');
                  return (
                    <Tr key={row.id} interactive>
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.studentName}`}
                          checked={selected.includes(row.id)}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, row.id]
                                : current.filter((id) => id !== row.id),
                            )
                          }
                          className="h-[18px] w-[18px] cursor-pointer rounded-[5px] border-line-strong text-brand-600 focus:ring-brand-600"
                        />
                      </Td>
                      <Td>
                        <Link
                          href={`/corporate/applications/${row.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar firstName={firstName} lastName={rest.join(' ') || firstName} size="sm" />
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink hover:text-brand-700">
                              {row.studentName}
                            </span>
                            <span className="block truncate text-xs text-ink-400">
                              {row.programme ?? 'Programme not set'}
                              {row.qualification && ` · ${qualificationLabels[row.qualification as keyof typeof qualificationLabels]}`}
                            </span>
                            <span className="block truncate text-xs text-ink-300">
                              {row.institution ?? 'Institution not set'}
                            </span>
                          </span>
                        </Link>
                      </Td>
                      <Td align="right">
                        {row.matchScore !== null ? (
                          <MatchBadge score={row.matchScore} size="sm" />
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {row.academicAverage !== null ? `${row.academicAverage}%` : '—'}
                      </Td>
                      <Td>
                        {row.eligibilityOutcome ? (
                          <EligibilityBadge outcome={row.eligibilityOutcome} />
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </Td>
                      <Td>
                        <ApplicationStatusBadge status={row.status} />
                      </Td>
                      <Td>{row.submittedAt ? formatDate(row.submittedAt) : '—'}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / pageSize))}
            total={total}
            pageSize={pageSize}
            onPageChange={(next) => setParam({ page: String(next) })}
          />
        </>
      )}

      <p className="sr-only" aria-live="polite">
        {formatNumber(total)} applications match the current filters.
      </p>
    </Card>
  );
}
