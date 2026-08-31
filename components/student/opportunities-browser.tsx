'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { FundingCoverage, FundingType, MatchClassification, Province, QualificationLevel } from '@prisma/client';
import { Calendar, Check, Filter, Search, X } from '@/components/icons';
import { Badge, MatchBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import {
  fundingCoverageLabels,
  fundingTypeLabels,
  provinceLabels,
  qualificationLabels,
  toOptions,
} from '@/lib/labels';
import { cn, daysUntil, formatDate } from '@/lib/utils';
import type { CatalogInstitution, CatalogProgramme } from '@/services/catalog';

export type OpportunityItem = {
  id: string;
  name: string;
  organisationName: string;
  shortDescription: string;
  fundingType: FundingType;
  coverage: FundingCoverage[];
  closingDate: string;
  courses: { id: string; name: string }[];
  institutions: { id: string; name: string }[];
  qualificationLevels: QualificationLevel[];
  provinces: Province[];
  matchScore: number;
  classification: MatchClassification;
  reasons: string[];
  applied: boolean;
};

const PAGE_SIZE = 8;

type Filters = {
  search: string;
  courseId: string;
  institutionId: string;
  qualification: string;
  fundingType: string;
  coverage: string;
  province: string;
  minMatch: string;
  closing: string;
  hideApplied: boolean;
};

const emptyFilters: Filters = {
  search: '',
  courseId: '',
  institutionId: '',
  qualification: '',
  fundingType: '',
  coverage: '',
  province: '',
  minMatch: '',
  closing: '',
  hideApplied: false,
};

/** Searchable, filterable opportunity list with match-aware sorting. */
export function OpportunitiesBrowser({
  items,
  catalog,
}: {
  items: OpportunityItem[];
  catalog: { institutions: CatalogInstitution[]; programmes: CatalogProgramme[] };
}) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState<'match' | 'closing' | 'name'>('match');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== 'search' && value !== '' && value !== false,
  ).length;

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();

    const result = items.filter((item) => {
      if (
        query &&
        !item.name.toLowerCase().includes(query) &&
        !item.organisationName.toLowerCase().includes(query) &&
        !item.shortDescription.toLowerCase().includes(query)
      ) {
        return false;
      }
      if (filters.courseId && !item.courses.some((c) => c.id === filters.courseId)) return false;
      if (filters.institutionId && !item.institutions.some((i) => i.id === filters.institutionId)) return false;
      if (filters.qualification && !item.qualificationLevels.includes(filters.qualification as QualificationLevel)) {
        return false;
      }
      if (filters.fundingType && item.fundingType !== filters.fundingType) return false;
      if (filters.coverage && !item.coverage.includes(filters.coverage as FundingCoverage)) return false;
      if (filters.province && item.provinces.length > 0 && !item.provinces.includes(filters.province as Province)) {
        return false;
      }
      if (filters.minMatch && item.matchScore < Number(filters.minMatch)) return false;
      if (filters.closing) {
        const days = daysUntil(item.closingDate);
        if (days > Number(filters.closing)) return false;
      }
      if (filters.hideApplied && item.applied) return false;
      return true;
    });

    return result.sort((a, b) => {
      if (sort === 'closing') return new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime();
      if (sort === 'name') return a.name.localeCompare(b.name);
      return b.matchScore - a.matchScore;
    });
  }, [items, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {/* -------------------------------------------------------- Toolbar */}
      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="search"
            value={filters.search}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Search opportunities, funders or keywords"
            leadingIcon={<Search className="h-4 w-4" />}
            aria-label="Search opportunities"
            className="flex-1"
          />
          <div className="flex gap-3">
            <Select
              options={[
                { value: 'match', label: 'Best match' },
                { value: 'closing', label: 'Closing soonest' },
                { value: 'name', label: 'Name (A–Z)' },
              ]}
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              aria-label="Sort opportunities"
              className="sm:w-[172px]"
            />
            <Button
              variant="outline"
              onClick={() => setShowFilters((s) => !s)}
              leadingIcon={<Filter className="h-4 w-4" />}
              aria-expanded={showFilters}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect
                label="Course"
                value={filters.courseId}
                onChange={(v) => update('courseId', v)}
                options={catalog.programmes.map((p) => ({ value: p.id, label: p.name }))}
              />
              <FilterSelect
                label="Institution"
                value={filters.institutionId}
                onChange={(v) => update('institutionId', v)}
                options={catalog.institutions.map((i) => ({ value: i.id, label: i.shortName ?? i.name }))}
              />
              <FilterSelect
                label="Qualification"
                value={filters.qualification}
                onChange={(v) => update('qualification', v)}
                options={toOptions(qualificationLabels)}
              />
              <FilterSelect
                label="Funding type"
                value={filters.fundingType}
                onChange={(v) => update('fundingType', v)}
                options={toOptions(fundingTypeLabels)}
              />
              <FilterSelect
                label="Covers"
                value={filters.coverage}
                onChange={(v) => update('coverage', v)}
                options={toOptions(fundingCoverageLabels)}
              />
              <FilterSelect
                label="Province"
                value={filters.province}
                onChange={(v) => update('province', v)}
                options={toOptions(provinceLabels)}
              />
              <FilterSelect
                label="Match score"
                value={filters.minMatch}
                onChange={(v) => update('minMatch', v)}
                options={[
                  { value: '85', label: 'Strong match (85%+)' },
                  { value: '60', label: 'Potential match (60%+)' },
                ]}
              />
              <FilterSelect
                label="Closing date"
                value={filters.closing}
                onChange={(v) => update('closing', v)}
                options={[
                  { value: '7', label: 'Within 7 days' },
                  { value: '30', label: 'Within 30 days' },
                  { value: '90', label: 'Within 90 days' },
                ]}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-600">
                <input
                  type="checkbox"
                  checked={filters.hideApplied}
                  onChange={(event) => update('hideApplied', event.target.checked)}
                  className="h-[18px] w-[18px] cursor-pointer rounded-[5px] border-line-strong text-brand-600 focus:ring-brand-600"
                />
                Hide opportunities I’ve applied to
              </label>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters(emptyFilters);
                    setPage(1);
                  }}
                  leadingIcon={<X className="h-3.5 w-3.5" />}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* --------------------------------------------------------- Results */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title="No opportunities match those filters"
            description="Try widening your search, or clear the filters to see everything that’s open."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setFilters(emptyFilters);
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <p className="mb-3.5 text-[13px] text-ink-400">
            Showing {visible.length} of {filtered.length} opportunities
          </p>

          <div className="space-y-4">
            {visible.map((item) => (
              <OpportunityRow key={item.id} item={item} />
            ))}
          </div>

          <Card className="mt-5">
            <Pagination
              page={page}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-700">{label}</span>
      <Select
        options={[{ value: '', label: `All ${label.toLowerCase()}s` }, ...options]}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
    </label>
  );
}

function OpportunityRow({ item }: { item: OpportunityItem }) {
  const days = daysUntil(item.closingDate);
  const closingSoon = days >= 0 && days <= 14;

  return (
    <article className="rounded-card border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-elevated">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold leading-snug text-ink">
              <Link href={`/student/opportunities/${item.id}`} className="hover:text-brand-700">
                {item.name}
              </Link>
            </h3>
            <Badge tone="neutral">{fundingTypeLabels[item.fundingType]}</Badge>
            {item.applied && <Badge tone="brand">Applied</Badge>}
          </div>
          <p className="mt-1 text-[13px] font-medium text-ink-500">{item.organisationName}</p>
          <p className="mt-2 text-[13px] leading-6 text-ink-400">{item.shortDescription}</p>
        </div>
        <MatchBadge score={item.matchScore} classification={item.classification} />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
            Supported courses
          </dt>
          <dd className="mt-1 text-[13px] text-ink-600">
            {item.courses.length === 0
              ? 'All courses'
              : item.courses.slice(0, 3).map((c) => c.name).join(', ') +
                (item.courses.length > 3 ? ` +${item.courses.length - 3} more` : '')}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
            Supported institutions
          </dt>
          <dd className="mt-1 text-[13px] text-ink-600">
            {item.institutions.length === 0
              ? 'All institutions'
              : item.institutions.slice(0, 3).map((i) => i.name).join(', ') +
                (item.institutions.length > 3 ? ` +${item.institutions.length - 3} more` : '')}
          </dd>
        </div>
      </dl>

      <ul className="mt-3.5 flex flex-wrap gap-1.5">
        {item.coverage.map((coverage) => (
          <li key={coverage}>
            <Badge tone="neutral" icon={<Check className="h-3 w-3" strokeWidth={2.6} />}>
              {fundingCoverageLabels[coverage]}
            </Badge>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p
          className={cn(
            'flex items-center gap-1.5 text-[13px]',
            closingSoon ? 'font-medium text-warning-600' : 'text-ink-400',
          )}
        >
          <Calendar className="h-4 w-4" />
          Closes {formatDate(item.closingDate)}
          {closingSoon && <span className="font-semibold">· {days === 0 ? 'today' : `${days} days left`}</span>}
        </p>
        <ButtonLink href={`/student/opportunities/${item.id}`} size="sm">
          View Opportunity
        </ButtonLink>
      </div>
    </article>
  );
}
