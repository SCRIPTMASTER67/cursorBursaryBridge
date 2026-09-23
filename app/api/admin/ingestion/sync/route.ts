import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiAdmin, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { rateLimit } from '@/lib/auth/rate-limit';
import { enabledSources, sourceById } from '@/lib/ingest/source-registry';
import { runSource } from '@/lib/ingest/pipeline';
import { finishRun, logEvent, persistOutcome, startRun } from '@/services/opportunity-ingest';
import { audit } from '@/services/audit';

/**
 * Sync a source on demand.
 *
 * The same pipeline the scheduled job runs, so an administrator pressing this
 * gets exactly what a scheduled run would have produced — including the
 * refusals. A source whose robots.txt disallows the page is not fetched here
 * either; there is no "force" option, because pressing a button does not
 * change what a site permits.
 */
const syncSchema = z.object({ sourceId: z.string().optional() });

export async function POST(request: NextRequest) {
  const auth = await apiAdmin();
  if (!auth.ok) return auth.response;

  // Syncing hits somebody else's servers, so it is rate limited even for an
  // administrator.
  const limit = rateLimit(`ingest:sync:${auth.user.id}`, 6, 600);
  if (!limit.allowed) {
    return apiError('Too many syncs. Please wait a few minutes before trying again.', 429);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = syncSchema.safeParse(body ?? {});
  if (!parsed.success) return apiError('Invalid request.', 422, zodFields(parsed.error));

  const sources = parsed.data.sourceId
    ? [sourceById(parsed.data.sourceId)].filter((source): source is NonNullable<typeof source> =>
        Boolean(source),
      )
    : enabledSources();

  if (sources.length === 0) {
    return apiError('That source is not registered, or none is authorised.', 404);
  }
  const unconfigured = sources.filter((s) => !s.enabled || s.listingUrls.length === 0);
  if (unconfigured.length === sources.length) {
    return apiError(
      'That source is registered but not authorised, or has no pages configured.',
      409,
    );
  }

  const run = await startRun('manual (admin)');
  const totals = {
    sourcesAttempted: 0,
    sourcesSucceeded: 0,
    sourcesBlocked: 0,
    sourcesFailed: 0,
    opportunitiesFound: 0,
    opportunitiesCreated: 0,
    opportunitiesUpdated: 0,
    duplicatesMerged: 0,
    rejected: 0,
  };
  const notes: string[] = [];

  for (const source of sources) {
    if (!source.enabled || source.listingUrls.length === 0) continue;
    totals.sourcesAttempted += 1;

    const outcome = await runSource(source);
    totals.opportunitiesFound += outcome.candidates.length;
    totals.rejected += outcome.rejections.length;

    if (outcome.status === 'blocked-by-robots') {
      totals.sourcesBlocked += 1;
      notes.push(`${source.name}: ${outcome.detail}`);
      await logEvent(run.id, 'WARN', `Not read: ${outcome.detail}`, {
        name: source.name,
        url: source.homepage,
      });
      continue;
    }
    if (outcome.status !== 'ok') {
      totals.sourcesFailed += 1;
      notes.push(`${source.name}: ${outcome.detail}`);
      await logEvent(run.id, 'ERROR', outcome.detail, { name: source.name, url: source.homepage });
      continue;
    }

    totals.sourcesSucceeded += 1;
    const written = await persistOutcome(run.id, outcome);
    totals.opportunitiesCreated += written.created;
    totals.opportunitiesUpdated += written.updated;
    totals.duplicatesMerged += written.merged;
  }

  // Reaching nothing is not the same as finding nothing.
  const reachedNothing = totals.sourcesSucceeded === 0 && totals.sourcesAttempted > 0;
  const status = reachedNothing ? 'BLOCKED' : totals.sourcesFailed > 0 ? 'FAILED' : 'SUCCEEDED';

  await finishRun(run.id, status, { ...totals, notes: notes.join('\n') || undefined });

  await audit({
    userId: auth.adminUserId,
    action: 'ingestion.sync_requested',
    entityType: 'IngestionRun',
    entityId: run.id,
    metadata: { status, ...totals },
  });

  return apiOk({ ok: true, runId: run.id, status, totals, notes });
}
