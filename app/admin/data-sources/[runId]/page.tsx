import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ArrowLeft, Inbox } from '@/components/icons';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { runEvents } from '@/services/admin-ingestion';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Collection run' };
export const dynamic = 'force-dynamic';

const LEVEL_TONE: Record<string, BadgeTone> = { INFO: 'neutral', WARN: 'warning', ERROR: 'danger' };

/**
 * Every decision one run made.
 *
 * Including the ones that refused something: a rejected candidate is recorded
 * with the reason, so an opportunity that did NOT reach the directory can be
 * accounted for just as precisely as one that did.
 */
export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  await requireAdmin();
  const { runId } = await params;

  const run = await prisma.ingestionRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      trigger: true,
      startedAt: true,
      finishedAt: true,
      sourcesAttempted: true,
      sourcesSucceeded: true,
      sourcesBlocked: true,
      sourcesFailed: true,
      opportunitiesFound: true,
      opportunitiesCreated: true,
      opportunitiesUpdated: true,
      duplicatesMerged: true,
      rejected: true,
      notes: true,
    },
  });
  if (!run) notFound();

  const events = await runEvents(runId);

  return (
    <PageBody>
      <Link
        href="/admin/data-sources"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Data sources
      </Link>

      <PageHeader
        title={`Collection run — ${run.status.toLowerCase()}`}
        description={`${run.trigger} · started ${formatDate(run.startedAt)}${
          run.finishedAt ? ` · finished ${formatDate(run.finishedAt)}` : ' · still running'
        }`}
      />

      <Card className="mb-5">
        <CardBody className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label="Sources attempted" value={run.sourcesAttempted} />
          <Fact label="Read successfully" value={run.sourcesSucceeded} />
          <Fact label="Disallowed by robots.txt" value={run.sourcesBlocked} />
          <Fact label="Unreachable" value={run.sourcesFailed} />
          <Fact label="Candidates found" value={run.opportunitiesFound} />
          <Fact label="Created" value={run.opportunitiesCreated} />
          <Fact label="Updated" value={run.opportunitiesUpdated} />
          <Fact label="Merged as duplicates" value={run.duplicatesMerged} />
          <Fact label="Rejected by validation" value={run.rejected} />
        </CardBody>
      </Card>

      {run.notes && (
        <Card className="mb-5">
          <CardBody>
            <p className="whitespace-pre-line text-sm text-ink-700">{run.notes}</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="p-0">
          {events.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="This run recorded no events"
              description="Nothing was read, so there was nothing to decide."
            />
          ) : (
            <ul className="divide-y divide-line">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3 px-5 py-3">
                  <Badge tone={LEVEL_TONE[event.level] ?? 'neutral'} className="mt-0.5 shrink-0">
                    {event.level.toLowerCase()}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-700">{event.message}</p>
                    {event.sourceUrl && (
                      <Link
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-0.5 block truncate text-2xs text-ink-400 hover:text-brand-600"
                      >
                        {event.sourceName ? `${event.sourceName} — ` : ''}
                        {event.sourceUrl}
                      </Link>
                    )}
                  </div>
                  <span className="shrink-0 text-2xs tabular-nums text-ink-400">
                    {event.createdAt.toISOString().slice(11, 19)}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
