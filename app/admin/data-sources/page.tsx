import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Table as TableWrap, Td, Th, Tr } from '@/components/ui/table-exports';
import { ChevronRight, Globe, ShieldCheck } from '@/components/icons';
import { requireAdmin } from '@/lib/auth/guards';
import { ingestionOverview } from '@/services/admin-ingestion';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Data sources' };
export const dynamic = 'force-dynamic';

const RUN_TONE: Record<string, BadgeTone> = {
  SUCCEEDED: 'success',
  RUNNING: 'info',
  FAILED: 'danger',
  BLOCKED: 'warning',
};

/**
 * Where the directory's data comes from, and whether it is current.
 *
 * The distinction this page exists to make visible: a run that found nothing
 * and a run that could not reach anything are different events, and only one
 * of them means the sources are empty.
 */
export default async function DataSourcesPage() {
  await requireAdmin();
  const overview = await ingestionOverview();
  const latest = overview.runs[0];

  return (
    <PageBody>
      <PageHeader
        title="Data sources"
        description="Where bursary opportunities come from, what each collection run did, and what needs attention."
      />

      {latest?.status === 'BLOCKED' && (
        <Alert tone="warning" title="The last run could not reach its sources" className="mb-5">
          {latest.notes || 'No source could be read.'} Nothing was collected and nothing was
          confirmed — which is not the same as the sources being empty. Anything past its{' '}
          {overview.attention.freshnessDays}-day freshness window is now shown as needing
          verification rather than open.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          value={overview.totals.opportunities}
          label="Opportunities"
          sublabel="Visible to students"
        />
        <StatCard
          value={overview.totals.byStatus.OPEN ?? 0}
          label="Open now"
          sublabel="Verified within the window"
          accent="success"
        />
        <StatCard
          value={overview.totals.byStatus.NEEDS_VERIFICATION ?? 0}
          label="Need checking"
          sublabel="Not confirmed recently"
          accent="warning"
        />
        <StatCard
          value={overview.attention.unresolvedConflicts}
          label="Source conflicts"
          sublabel="Sources disagree, unresolved"
          accent="info"
        />
      </div>

      {(overview.attention.withoutSource > 0 || overview.attention.unresolvedConflicts > 0) && (
        <Alert tone="danger" className="mt-5">
          {overview.attention.withoutSource > 0 && (
            <>
              {overview.attention.withoutSource} externally-sourced opportunit
              {overview.attention.withoutSource === 1 ? 'y has' : 'ies have'} no source URL. An
              opportunity with no source should not be in the directory.{' '}
            </>
          )}
          {overview.attention.unresolvedConflicts > 0 && (
            <>
              {overview.attention.unresolvedConflicts} conflict
              {overview.attention.unresolvedConflicts === 1 ? '' : 's'} between sources of equal
              standing could not be resolved automatically and need a decision.
            </>
          )}
        </Alert>
      )}

      <Card className="mt-5">
        <CardHeader
          title="Registered sources"
          description="A source is only read when it is authorised here AND has listing pages configured. Its own robots.txt is consulted before every fetch."
        />
        <CardBody className="p-0">
          <TableWrap>
            <thead>
              <Tr>
                <Th>Source</Th>
                <Th>Level</Th>
                <Th>State</Th>
                <Th>Why</Th>
              </Tr>
            </thead>
            <tbody>
              {overview.sources.map((source) => (
                <Tr key={source.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      {source.official ? (
                        <ShieldCheck className="h-4 w-4 shrink-0 text-success-600" />
                      ) : (
                        <Globe className="h-4 w-4 shrink-0 text-ink-400" />
                      )}
                      <Link
                        href={source.homepage}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="font-medium text-ink hover:text-brand-600"
                      >
                        {source.name}
                      </Link>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={source.official ? 'success' : 'neutral'}>
                      {source.type.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  </Td>
                  <Td>
                    {!source.enabled ? (
                      <Badge tone="neutral">Not authorised</Badge>
                    ) : source.configured ? (
                      <Badge tone="success">Enabled</Badge>
                    ) : (
                      <Badge tone="warning">No pages configured</Badge>
                    )}
                  </Td>
                  <Td className="max-w-[420px] text-[13px] text-ink-600">{source.note}</Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Collection runs"
          description="The ten most recent. Open one to see every decision it made."
        />
        <CardBody className="p-0">
          {overview.runs.length === 0 ? (
            <EmptyState
              icon={<Globe className="h-5 w-5" />}
              title="No collection run yet"
              description="Run `npm run ingest` to read the authorised sources, or `npm run verify:opportunities` to re-check what is already stored."
            />
          ) : (
            <TableWrap>
              <thead>
                <Tr>
                  <Th>Started</Th>
                  <Th>Trigger</Th>
                  <Th>Result</Th>
                  <Th>Sources</Th>
                  <Th>Opportunities</Th>
                  <Th />
                </Tr>
              </thead>
              <tbody>
                {overview.runs.map((run) => (
                  <Tr key={run.id}>
                    <Td className="whitespace-nowrap">{formatDate(run.startedAt)}</Td>
                    <Td className="text-[13px] text-ink-600">{run.trigger}</Td>
                    <Td>
                      <Badge tone={RUN_TONE[run.status] ?? 'neutral'}>
                        {run.status.toLowerCase()}
                      </Badge>
                    </Td>
                    <Td className="text-[13px] text-ink-600">
                      {run.sourcesSucceeded} read
                      {run.sourcesBlocked > 0 && `, ${run.sourcesBlocked} disallowed`}
                      {run.sourcesFailed > 0 && `, ${run.sourcesFailed} unreachable`}
                    </Td>
                    <Td className="text-[13px] text-ink-600">
                      {run.opportunitiesCreated} new, {run.opportunitiesUpdated} updated,{' '}
                      {run.duplicatesMerged} merged, {run.rejected} rejected
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/data-sources/${run.id}`}
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600"
                      >
                        {run._count.events} event{run._count.events === 1 ? '' : 's'}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Where the directory's opportunities come from" />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Fact label="Published here by their funder" value={overview.totals.firstParty} />
          <Fact label="Collected from a public source" value={overview.totals.external} />
          <Fact label="Backed by an official source" value={overview.totals.official} />
        </CardBody>
      </Card>
    </PageBody>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
