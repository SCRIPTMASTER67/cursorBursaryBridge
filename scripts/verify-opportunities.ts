/**
 * Re-check what the directory is claiming.
 *
 * Run this on a schedule. It does two things, and the first works whether or
 * not the sources are reachable:
 *
 *   1. Close anything whose own deadline has passed, and stop treating
 *      anything unconfirmed as verified. No network needed.
 *   2. Re-read the sources behind the opportunities that most need it.
 *
 * Suggested schedule:
 *   hourly   npm run verify:opportunities -- --local-only
 *   daily    npm run verify:opportunities
 */
import '../lib/load-env';
import { PrismaClient } from '@prisma/client';
import { finishRun, startRun } from '../services/opportunity-ingest';
import { recheckFromSources, sweepLocalStatus } from '../services/opportunity-verify';

const db = new PrismaClient();
const localOnly = process.argv.includes('--local-only');

async function main() {
  const run = await startRun(localOnly ? 'scheduled (local)' : 'scheduled');

  const sweep = await sweepLocalStatus();
  console.log('Local sweep (no network needed):');
  console.log(`  ${sweep.scanned} opportunities scanned`);
  console.log(`  ${sweep.closedByDeadline} closed because their deadline has passed`);
  console.log(`  ${sweep.markedUpcoming} marked upcoming because they have not opened yet`);
  console.log(`  ${sweep.markedStale} marked as needing verification`);

  if (localOnly) {
    await finishRun(run.id, 'SUCCEEDED', {
      sourcesAttempted: 0,
      sourcesSucceeded: 0,
      sourcesBlocked: 0,
      sourcesFailed: 0,
      opportunitiesFound: sweep.scanned,
      opportunitiesCreated: 0,
      opportunitiesUpdated: sweep.closedByDeadline + sweep.markedUpcoming + sweep.markedStale,
      duplicatesMerged: 0,
      rejected: 0,
      notes: 'Local sweep only. No source was contacted.',
    });
    await db.$disconnect();
    return;
  }

  console.log('\nRe-checking sources:');
  const recheck = await recheckFromSources({ runId: run.id });
  console.log(`  ${recheck.checked} checked`);
  console.log(`  ${recheck.confirmed} confirmed unchanged`);
  console.log(`  ${recheck.changed} changed`);
  console.log(`  ${recheck.gone} no longer carried by their source`);
  console.log(`  ${recheck.unreachable} could not be reached`);

  // If everything we tried to reach was unreachable, the run achieved nothing
  // and must not be recorded as a success.
  const reachedNothing =
    recheck.checked > 0 && recheck.confirmed + recheck.changed + recheck.gone === 0;
  if (reachedNothing) {
    console.log(
      '\nNo source could be reached. Nothing was confirmed, and anything past its\n' +
        'freshness window is now marked as needing verification rather than open.',
    );
  }

  await finishRun(run.id, reachedNothing ? 'BLOCKED' : 'SUCCEEDED', {
    sourcesAttempted: recheck.checked,
    sourcesSucceeded: recheck.confirmed + recheck.changed + recheck.gone,
    sourcesBlocked: 0,
    sourcesFailed: recheck.unreachable,
    opportunitiesFound: sweep.scanned,
    opportunitiesCreated: 0,
    opportunitiesUpdated: recheck.changed + sweep.closedByDeadline + sweep.markedStale,
    duplicatesMerged: 0,
    rejected: 0,
    notes: reachedNothing ? 'No source could be reached.' : undefined,
  });

  await db.$disconnect();
  process.exit(reachedNothing ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
