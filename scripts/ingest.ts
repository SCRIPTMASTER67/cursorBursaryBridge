/**
 * Run the ingestion pipeline.
 *
 * Usage:
 *   npm run ingest              read the enabled sources and store what they carry
 *   npm run ingest -- --dry-run read and report, write nothing
 *
 * Every run is recorded, including one that achieved nothing. A run that could
 * not reach its sources is marked BLOCKED, not SUCCEEDED with zero results:
 * "we found no bursaries" and "we could not look" are different statements,
 * and only one of them should ever reach a student.
 */
import '../lib/load-env';
import { PrismaClient } from '@prisma/client';
import { enabledSources, SOURCES } from '../lib/ingest/source-registry';
import { runSource } from '../lib/ingest/pipeline';
import { finishRun, logEvent, persistOutcome, startRun } from '../services/opportunity-ingest';

const db = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const sources = enabledSources();

  console.log('Registered sources:');
  for (const source of SOURCES) {
    const state = !source.enabled
      ? 'not authorised'
      : source.listingUrls.length === 0
        ? 'authorised, no listing pages configured'
        : 'enabled';
    console.log(`  ${source.name.padEnd(32)} ${state}`);
  }
  console.log('');

  if (sources.length === 0) {
    console.log('No source is both authorised and configured. Nothing to do.');
    await db.$disconnect();
    return;
  }

  const run = await startRun(dryRun ? 'manual (dry run)' : 'manual');
  console.log(`Run ${run.id} started${dryRun ? ' (dry run — nothing will be written)' : ''}.\n`);

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
    totals.sourcesAttempted += 1;
    console.log(`${source.name} (${source.type})`);

    const outcome = await runSource(source);
    totals.opportunitiesFound += outcome.candidates.length;
    totals.rejected += outcome.rejections.length;

    if (outcome.status === 'blocked-by-robots') {
      totals.sourcesBlocked += 1;
      const message = `Not read: ${outcome.detail}`;
      console.log(`  ${message}`);
      notes.push(`${source.name}: ${outcome.detail}`);
      await logEvent(run.id, 'WARN', message, { name: source.name, url: source.homepage });
      continue;
    }

    if (outcome.status === 'no-egress') {
      totals.sourcesFailed += 1;
      const message = `Could not reach the source: ${outcome.detail}`;
      console.log(`  ${message}`);
      notes.push(`${source.name}: no outbound network access.`);
      await logEvent(run.id, 'ERROR', message, { name: source.name, url: source.homepage });
      continue;
    }

    if (outcome.status === 'failed') {
      totals.sourcesFailed += 1;
      console.log(`  Failed: ${outcome.detail}`);
      await logEvent(run.id, 'ERROR', outcome.detail, { name: source.name });
      continue;
    }

    totals.sourcesSucceeded += 1;
    console.log(`  ${outcome.detail}`);

    for (const candidate of outcome.candidates.slice(0, 10)) {
      console.log(
        `    ${candidate.availability.padEnd(8)} ${candidate.value.title} — ${candidate.value.organisationName}`,
      );
    }

    if (!dryRun) {
      const written = await persistOutcome(run.id, outcome);
      totals.opportunitiesCreated += written.created;
      totals.opportunitiesUpdated += written.updated;
      totals.duplicatesMerged += written.merged;
      console.log(
        `  Stored: ${written.created} new, ${written.updated} updated, ${written.merged} merged into existing.`,
      );
    }
  }

  // A run that reached nothing must not look like a run that found nothing.
  const reachedNothing = totals.sourcesSucceeded === 0 && totals.sourcesAttempted > 0;
  const status = reachedNothing ? 'BLOCKED' : totals.sourcesFailed > 0 ? 'FAILED' : 'SUCCEEDED';

  await finishRun(run.id, status, { ...totals, notes: notes.join('\n') || undefined });

  console.log('\n' + '-'.repeat(70));
  console.log(`Run ${status}.`);
  console.log(
    `  sources: ${totals.sourcesSucceeded} read, ${totals.sourcesBlocked} disallowed by robots.txt, ${totals.sourcesFailed} unreachable`,
  );
  console.log(
    `  opportunities: ${totals.opportunitiesFound} found, ${totals.opportunitiesCreated} created, ${totals.opportunitiesUpdated} updated, ${totals.duplicatesMerged} merged, ${totals.rejected} rejected`,
  );
  if (reachedNothing) {
    console.log(
      '\nNo source could be read, so the database is unchanged. This is NOT the same\n' +
        'as there being no bursaries: nothing was looked at. The directory will show\n' +
        'what it already holds, and no opportunity has been marked verified by this run.',
    );
  }

  await db.$disconnect();
  process.exit(status === 'SUCCEEDED' ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
