'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ShortlistStatus } from '@prisma/client';
import { MatchBadge, ShortlistStatusBadge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, Td, Th, Tr } from '@/components/ui/table-exports';
import { useToast } from '@/components/ui/toast';
import { Search, Star } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export type ShortlistRow = {
  applicationId: string;
  studentName: string;
  institution: string | null;
  programme: string | null;
  academicAverage: number | null;
  matchScore: number | null;
  status: ShortlistStatus;
  addedAt: string;
  programmeName: string;
};

/**
 * Shortlist and beneficiary table.
 *
 * `mode` switches between the working shortlist (where applicants can be moved
 * to Selected) and the read-only beneficiary register.
 */
export function ShortlistTable({
  rows,
  programmes,
  mode = 'shortlist',
}: {
  rows: ShortlistRow[];
  programmes: { id: string; name: string }[];
  mode?: 'shortlist' | 'beneficiaries';
}) {
  const router = useRouter();
  const toast = useToast();

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [sort, setSort] = useState<'match' | 'name' | 'date' | 'average'>('match');
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (query && !row.studentName.toLowerCase().includes(query)) return false;
        if (programmeFilter && row.programmeName !== programmeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === 'name') return a.studentName.localeCompare(b.studentName);
        if (sort === 'date') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        if (sort === 'average') return (b.academicAverage ?? 0) - (a.academicAverage ?? 0);
        return (b.matchScore ?? 0) - (a.matchScore ?? 0);
      });
  }, [rows, search, programmeFilter, sort]);

  async function bulk(action: 'SELECT' | 'REMOVE') {
    if (selected.length === 0) return;
    setBusy(true);
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
          : `${payload.affected} applicant(s) removed from the shortlist.`,
      );
      setSelected([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Star className="h-5 w-5" />}
          title={mode === 'shortlist' ? 'Nothing shortlisted yet' : 'No beneficiaries yet'}
          description={
            mode === 'shortlist'
              ? 'Shortlist applicants from your Applications list and they will appear here.'
              : 'Applicants you move to Selected become beneficiaries and appear here.'
          }
        />
      </Card>
    );
  }

  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.includes(row.applicationId));

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name"
          leadingIcon={<Search className="h-4 w-4" />}
          aria-label="Search shortlist"
          className="flex-1"
        />
        <Select
          options={[
            { value: '', label: 'All programmes' },
            ...programmes.map((p) => ({ value: p.name, label: p.name })),
          ]}
          value={programmeFilter}
          onChange={(event) => setProgrammeFilter(event.target.value)}
          aria-label="Filter by programme"
          className="sm:w-[220px]"
        />
        <Select
          options={[
            { value: 'match', label: 'Best match' },
            { value: 'average', label: 'Highest average' },
            { value: 'date', label: 'Most recent' },
            { value: 'name', label: 'Name (A–Z)' },
          ]}
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
          aria-label="Sort shortlist"
          className="sm:w-[170px]"
        />
      </div>

      {mode === 'shortlist' && selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-brand-50/60 px-5 py-3">
          <p className="text-[13px] font-medium text-ink">
            {selected.length} applicant{selected.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => bulk('REMOVE')} loading={busy}>
              Remove from shortlist
            </Button>
            <Button size="sm" variant="success" onClick={() => bulk('SELECT')} loading={busy}>
              Move to Selected
            </Button>
          </div>
        </div>
      )}

      <Table>
        <thead>
          <tr>
            {mode === 'shortlist' && (
              <Th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allVisibleSelected}
                  onChange={(event) =>
                    setSelected(event.target.checked ? visible.map((row) => row.applicationId) : [])
                  }
                  className="h-[18px] w-[18px] cursor-pointer rounded-[5px] border-line-strong text-brand-600 focus:ring-brand-600"
                />
              </Th>
            )}
            <Th>Applicant</Th>
            <Th align="right">Match %</Th>
            <Th align="right">Average</Th>
            <Th>Programme</Th>
            <Th>{mode === 'shortlist' ? 'Date shortlisted' : 'Date selected'}</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const [firstName, ...rest] = row.studentName.split(' ');
            return (
              <Tr key={row.applicationId} interactive>
                {mode === 'shortlist' && (
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.studentName}`}
                      checked={selected.includes(row.applicationId)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, row.applicationId]
                            : current.filter((id) => id !== row.applicationId),
                        )
                      }
                      className="h-[18px] w-[18px] cursor-pointer rounded-[5px] border-line-strong text-brand-600 focus:ring-brand-600"
                    />
                  </Td>
                )}
                <Td>
                  <Link
                    href={`/corporate/applications/${row.applicationId}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar firstName={firstName} lastName={rest.join(' ') || firstName} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink hover:text-brand-700">
                        {row.studentName}
                      </span>
                      <span className="block truncate text-xs text-ink-400">
                        {row.programme ?? '—'}
                        {row.institution && ` · ${row.institution}`}
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
                <Td className="max-w-[220px] truncate">{row.programmeName}</Td>
                <Td>{formatDate(row.addedAt)}</Td>
                <Td>
                  <ShortlistStatusBadge status={row.status} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>

      <p className="px-5 py-3.5 text-[13px] text-ink-400">
        Showing {visible.length} of {rows.length}
      </p>
    </Card>
  );
}
