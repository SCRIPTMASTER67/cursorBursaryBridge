/**
 * Ingest from pages you have already fetched.
 *
 * When the environment has no outbound network access, the pipeline cannot
 * reach a source — but it can still read one. Save the pages yourself, drop
 * them in a directory, and this runs the identical pipeline over them:
 * the same parser, the same normalisation, the same validation, the same
 * deduplication and the same provenance.
 *
 *   mkdir -p import
 *   # save each page, naming the file after its URL
 *   curl -o import/https___www.example.co.za_bursaries.html https://...
 *   npm run import:pages -- import --source zabursaries
 *
 * A saved batch usually mixes listing pages with detail pages, so
 * `--adapter listing-generic` or `--adapter zabursaries` overrides the one the
 * source is registered with. Run it once per shape if you have both.
 *
 * A file's URL is taken from its name (with `/` written as `_`) or from a
 * `<link rel="canonical">` in the page. A page whose URL cannot be determined
 * is skipped rather than given one, because a made-up source URL is exactly
 * the thing the rest of this system exists to prevent.
 *
 * robots.txt is NOT consulted here, because nothing is fetched. You fetched
 * the page; honouring the site's terms when you did so is your call, and this
 * script says so rather than pretending to have checked.
 */
import '../lib/load-env';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { runSource } from '../lib/ingest/pipeline';
import { sourceById, SOURCES, type AdapterId } from '../lib/ingest/source-registry';
import { finishRun, logEvent, persistOutcome, startRun } from '../services/opportunity-ingest';

const db = new PrismaClient();

const args = process.argv.slice(2);
const directory = args.find((a) => !a.startsWith('--')) ?? 'import';
const sourceId = valueOf('--source') ?? 'zabursaries';
const adapterOverride = valueOf('--adapter') as AdapterId | undefined;
const dryRun = args.includes('--dry-run');

const ADAPTERS: AdapterId[] = ['listing-generic', 'zabursaries'];

function valueOf(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

/** Recover the page's own URL. Never invented. */
function urlFor(file: string, html: string): string | null {
  const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html);
  if (canonical) return canonical[1];

  const fromOg = /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (fromOg) return fromOg[1];

  // A filename written as the URL with `/` replaced by `_`.
  const base = path.basename(file).replace(/\.html?$/i, '');
  const guess = base
    .replace(/^https?___/i, (m) => (m.toLowerCase().startsWith('https') ? 'https://' : 'http://'))
    .replace(/_/g, '/');
  try {
    const url = new URL(guess);
    return url.protocol.startsWith('http') ? url.toString() : null;
  } catch {
    return null;
  }
}

async function main() {
  const registered = sourceById(sourceId);
  if (!registered) {
    console.error(
      `Unknown source "${sourceId}". Registered: ${SOURCES.map((s) => s.id).join(', ')}`,
    );
    process.exit(1);
  }
  if (adapterOverride && !ADAPTERS.includes(adapterOverride)) {
    console.error(`Unknown adapter "${adapterOverride}". Available: ${ADAPTERS.join(', ')}`);
    process.exit(1);
  }
  const source = adapterOverride ? { ...registered, adapter: adapterOverride } : registered;

  let entries: string[];
  try {
    entries = readdirSync(directory)
      .filter((name) => /\.html?$/i.test(name))
      .map((name) => path.join(directory, name))
      .filter((file) => statSync(file).isFile());
  } catch {
    console.error(`Could not read "${directory}". Create it and put the saved pages in it.`);
    process.exit(1);
  }

  if (entries.length === 0) {
    console.error(`No .html files in "${directory}".`);
    process.exit(1);
  }

  console.log(
    `Reading ${entries.length} saved page(s) as ${source.name} (${source.type}), ` +
      `using the ${source.adapter} reader.`,
  );
  console.log('Nothing is fetched. robots.txt is not consulted, because you did the fetching.\n');

  const pages = new Map<string, string>();
  const skipped: string[] = [];
  for (const file of entries) {
    const html = readFileSync(file, 'utf8');
    const url = urlFor(file, html);
    if (!url) {
      skipped.push(file);
      continue;
    }
    pages.set(url, html);
  }

  for (const file of skipped) {
    console.log(
      `  skipped ${file} — its URL could not be determined, and one will not be invented.`,
    );
  }
  if (pages.size === 0) {
    console.error(
      '\nNo page had a usable URL. Name each file after its URL, or keep the page’s canonical link.',
    );
    process.exit(1);
  }

  const run = await startRun(dryRun ? 'import (dry run)' : 'import');
  await logEvent(run.id, 'INFO', `Reading ${pages.size} page(s) supplied from disk, not fetched.`);

  const outcome = await runSource(
    { ...source, listingUrls: [...pages.keys()] },
    {
      maxDetailPages: 0,
      fetcher: async (url: string) => {
        const body = pages.get(url);
        return body
          ? { ok: true as const, body, url }
          : { ok: false as const, reason: 'Not among the supplied pages.', kind: 'http' };
      },
    },
  );

  console.log(
    `\n${outcome.candidates.length} candidate(s), ${outcome.rejections.length} rejected.\n`,
  );
  for (const candidate of outcome.candidates) {
    console.log(
      `  ${candidate.availability.padEnd(8)} ${candidate.value.title}\n` +
        `           ${candidate.value.organisationName} · ${candidate.value.sourceUrl}`,
    );
  }
  for (const rejection of outcome.rejections) {
    console.log(`  REJECTED ${rejection.title} — ${rejection.reason}`);
  }

  if (dryRun) {
    console.log('\nDry run — nothing was written.');
    await finishRun(run.id, 'SUCCEEDED', {
      sourcesAttempted: pages.size,
      sourcesSucceeded: pages.size,
      sourcesBlocked: 0,
      sourcesFailed: 0,
      opportunitiesFound: outcome.candidates.length,
      opportunitiesCreated: 0,
      opportunitiesUpdated: 0,
      duplicatesMerged: 0,
      rejected: outcome.rejections.length,
      notes: 'Dry run over supplied pages.',
    });
    await db.$disconnect();
    return;
  }

  const written = await persistOutcome(run.id, outcome);
  await finishRun(run.id, 'SUCCEEDED', {
    sourcesAttempted: pages.size,
    sourcesSucceeded: pages.size,
    sourcesBlocked: 0,
    sourcesFailed: 0,
    opportunitiesFound: outcome.candidates.length,
    opportunitiesCreated: written.created,
    opportunitiesUpdated: written.updated,
    duplicatesMerged: written.merged,
    rejected: outcome.rejections.length,
    notes: `Imported from ${pages.size} page(s) supplied on disk. These were not fetched by Bursary-Bridge.`,
  });

  console.log(
    `\nStored: ${written.created} new, ${written.updated} updated, ${written.merged} merged.`,
  );
  console.log('Run `npm run audit:production` to confirm nothing invented got through.');

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
