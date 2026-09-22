import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { BursaryCard } from '@/components/student/bursaries/bursary-card';
import { DirectoryFilters } from '@/components/student/bursaries/directory-filters';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Bookmark, InfoCircle, Search } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { directoryFacets, directoryTotals, listDirectory } from '@/services/bursary-directory';
import { formatDate } from '@/lib/utils';
import type { DisplayStatus } from '@/lib/bursary-status';
import type { CareerInterest, FundingType, Province, QualificationLevel } from '@prisma/client';

export const metadata: Metadata = { title: 'All Bursaries' };
export const dynamic = 'force-dynamic';

/**
 * The complete bursary directory.
 *
 * Deliberately not personalised. Everything Bursary-Bridge holds is here,
 * including opportunities this student does not qualify for and ones that have
 * closed. My Matches is the personalised experience and is a separate page —
 * the two answer different questions and are not merged.
 */
export default async function BursaryDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOnboardedStudent();
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };

  const [{ rows, total, page, pageCount, counts }, facets, totals] = await Promise.all([
    listDirectory({
      search: one('search'),
      status: one('status') as DisplayStatus | 'ALL' | undefined,
      fundingType: one('fundingType') as FundingType | undefined,
      field: one('field') as CareerInterest | undefined,
      province: one('province') as Province | undefined,
      qualification: one('qualification') as QualificationLevel | undefined,
      institutionId: one('institution'),
      page: Number(one('page') ?? '1') || 1,
    }),
    directoryFacets(),
    directoryTotals(),
  ]);

  const filtered = Boolean(
    one('search') ||
      one('status') ||
      one('fundingType') ||
      one('field') ||
      one('province') ||
      one('qualification') ||
      one('institution'),
  );

  return (
    <PageBody>
      <PageHeader
        title="All Bursaries"
        description="Every funding opportunity in the Bursary-Bridge database, whether or not it matches your profile. Open opportunities come first; closed ones stay listed so you know who funds what and when to come back."
        actions={
          <ButtonLink href="/student/opportunities" variant="outline">
            My Matches
          </ButtonLink>
        }
      />

      <Card className="mb-5">
        <CardBody>
          <DirectoryFilters facets={facets} counts={counts} />
        </CardBody>
      </Card>

      {totals.counts.NEEDS_VERIFICATION > 0 && (
        <Alert tone="warning" className="mb-5">
          {totals.counts.NEEDS_VERIFICATION} opportunit
          {totals.counts.NEEDS_VERIFICATION === 1 ? 'y has' : 'ies have'} not been confirmed with
          their source recently, so we are not showing them as open. Check the source before you
          rely on them.
        </Alert>
      )}

      {rows.length === 0 ? (
        counts.ALL === 0 ? (
          <Card>
            <EmptyState
              icon={<Bookmark className="h-5 w-5" />}
              title="No bursaries in the directory yet"
              description="Bursary-Bridge only lists opportunities it can trace to a real source, so this stays empty until verified opportunities have been collected. Nothing here is made up to fill the space."
              action={
                <ButtonLink href="/student/opportunities" variant="outline">
                  Go to My Matches
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No bursaries match these filters"
              description="Try widening your search, or clear the filters to see the whole directory."
              action={
                <ButtonLink href="/student/bursaries" variant="outline">
                  Clear filters
                </ButtonLink>
              }
            />
          </Card>
        )
      ) : (
        <>
          <p className="mb-3 text-[13px] text-ink-500">
            {total} {total === 1 ? 'opportunity' : 'opportunities'}
            {filtered ? ' match these filters' : ' in the directory'}
            {counts.OPEN > 0 && `, ${counts.OPEN} open now`}.
          </p>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <BursaryCard key={row.id} row={row} />
            ))}
          </div>

          {pageCount > 1 && (
            <nav
              aria-label="Directory pages"
              className="mt-6 flex items-center justify-center gap-3"
            >
              {page > 1 && (
                <ButtonLink href={pageHref(params, page - 1)} variant="outline" size="sm">
                  Previous
                </ButtonLink>
              )}
              <span className="text-[13px] tabular-nums text-ink-600">
                Page {page} of {pageCount}
              </span>
              {page < pageCount && (
                <ButtonLink href={pageHref(params, page + 1)} variant="outline" size="sm">
                  Next
                </ButtonLink>
              )}
            </nav>
          )}
        </>
      )}

      <Card className="mt-6">
        <CardBody className="flex gap-3">
          <InfoCircle className="h-[18px] w-[18px] shrink-0 text-ink-400" />
          <div className="text-[13px] text-ink-600">
            <p className="font-semibold text-ink">Where this comes from</p>
            <p className="mt-1">
              Every opportunity here is recorded with the source it came from and the date it was
              last confirmed. Open each one to see both. Bursary information changes, so check the
              source before you submit anything.
            </p>
            {totals.lastRun && (
              <p className="mt-1.5">
                Last collection run:{' '}
                {totals.lastRun.finishedAt
                  ? formatDate(totals.lastRun.finishedAt)
                  : formatDate(totals.lastRun.startedAt)}{' '}
                — {totals.lastRun.status.toLowerCase()}
                {totals.lastRun.notes ? `. ${totals.lastRun.notes.split('\n')[0]}` : '.'}
              </p>
            )}
            <p className="mt-1.5">
              Looking for what fits you specifically?{' '}
              <Link
                href="/student/opportunities"
                className="font-semibold text-brand-600 underline"
              >
                My Matches
              </Link>{' '}
              filters this list against your profile.
            </p>
          </div>
        </CardBody>
      </Card>
    </PageBody>
  );
}

/** Keep every active filter when moving between pages. */
function pageHref(params: Record<string, string | string[] | undefined>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value && key !== 'page') query.set(key, value);
  }
  query.set('page', String(page));
  return `/student/bursaries?${query.toString()}`;
}
