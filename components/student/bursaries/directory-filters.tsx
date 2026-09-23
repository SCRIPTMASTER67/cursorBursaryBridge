'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { CareerInterest, FundingType, Province, QualificationLevel } from '@prisma/client';
import type { DisplayStatus } from '@/lib/bursary-status';
import type { StatusCounts } from '@/services/bursary-directory';
import { STATUS_COPY, STATUS_ORDER } from '@/lib/bursary-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Search, X } from '@/components/icons';
import {
  careerInterestLabels,
  fundingTypeLabels,
  provinceLabels,
  qualificationLabels,
} from '@/lib/labels';
import { cn } from '@/lib/utils';

/**
 * Narrowing the directory.
 *
 * Filters live in the URL so a filtered view can be shared and the back button
 * works. Each status tab carries its real count, so the number of open
 * bursaries is visible before anything is clicked — and a zero reads as zero.
 */

export type Facets = {
  fields: CareerInterest[];
  institutions: { id: string; name: string; shortName: string | null }[];
  provinces: Province[];
  fundingTypes: FundingType[];
};

const QUALIFICATIONS: QualificationLevel[] = [
  'CERTIFICATE',
  'DIPLOMA',
  'ADVANCED_DIPLOMA',
  'BACHELORS',
  'HONOURS',
  'MASTERS',
  'DOCTORAL',
];

export function DirectoryFilters({ facets, counts }: { facets: Facets; counts: StatusCounts }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get('search') ?? '');

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const status = (params.get('status') as DisplayStatus | 'ALL' | null) ?? 'ALL';
  const activeCount = ['fundingType', 'field', 'province', 'qualification', 'institution'].filter(
    (key) => params.get(key),
  ).length;

  return (
    <div className="grid gap-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply({ search });
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by bursary, organisation, course or institution"
            aria-label="Search bursaries"
            className="pl-9"
          />
        </div>
        <Button type="submit" loading={pending}>
          Search
        </Button>
      </form>

      {/* Status first, and with real counts: what is open today is the thing
          most students came here to find. */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        <StatusTab
          label="All"
          count={counts.ALL}
          active={status === 'ALL'}
          onClick={() => apply({ status: null })}
        />
        {STATUS_ORDER.map((value) => (
          <StatusTab
            key={value}
            label={STATUS_COPY[value].label}
            count={counts[value]}
            active={status === value}
            emphasise={value === 'OPEN' || value === 'CLOSING_SOON'}
            onClick={() => apply({ status: value })}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Funding type"
          value={params.get('fundingType') ?? ''}
          onChange={(event) => apply({ fundingType: event.target.value })}
          options={[
            { value: '', label: 'Any funding type' },
            ...facets.fundingTypes.map((value) => ({ value, label: fundingTypeLabels[value] })),
          ]}
        />
        <Select
          aria-label="Field of study"
          value={params.get('field') ?? ''}
          onChange={(event) => apply({ field: event.target.value })}
          options={[
            { value: '', label: 'Any field of study' },
            ...facets.fields.map((value) => ({ value, label: careerInterestLabels[value] })),
          ]}
        />
        <Select
          aria-label="Institution"
          value={params.get('institution') ?? ''}
          onChange={(event) => apply({ institution: event.target.value })}
          options={[
            { value: '', label: 'Any institution' },
            ...facets.institutions.map((i) => ({ value: i.id, label: i.shortName ?? i.name })),
          ]}
        />
        <Select
          aria-label="Province"
          value={params.get('province') ?? ''}
          onChange={(event) => apply({ province: event.target.value })}
          options={[
            { value: '', label: 'Any province' },
            ...facets.provinces.map((value) => ({ value, label: provinceLabels[value] })),
          ]}
        />
        <Select
          aria-label="Qualification"
          value={params.get('qualification') ?? ''}
          onChange={(event) => apply({ qualification: event.target.value })}
          options={[
            { value: '', label: 'Any qualification' },
            ...QUALIFICATIONS.map((value) => ({ value, label: qualificationLabels[value] })),
          ]}
        />
        {(activeCount > 0 || params.get('search') || params.get('status')) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              startTransition(() => router.push(pathname));
            }}
            leadingIcon={<X className="h-4 w-4" />}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusTab({
  label,
  count,
  active,
  emphasise,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  emphasise?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-btn px-3.5 py-2 text-[13px] font-semibold ring-1 transition-colors',
        active
          ? 'bg-brand-600 text-white ring-brand-600'
          : 'bg-white text-ink-600 ring-line hover:bg-surface-subtle',
      )}
    >
      {emphasise && !active && (
        <span className="h-1.5 w-1.5 rounded-full bg-success-600" aria-hidden="true" />
      )}
      {label}
      <span className={cn('tabular-nums', active ? 'text-white/80' : 'text-ink-400')}>{count}</span>
    </button>
  );
}
