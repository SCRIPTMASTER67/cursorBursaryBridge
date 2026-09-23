import 'server-only';
import { prisma } from '@/lib/db';
import { SOURCES } from '@/lib/ingest/source-registry';
import { displayStatus } from '@/lib/bursary-status';
import { FRESHNESS_DAYS } from '@/lib/ingest/validate';

/**
 * What the data-collection machinery has actually been doing.
 *
 * An administrator should never have to guess whether the directory is fresh,
 * and should be able to see the difference between "nothing was found" and
 * "nothing could be reached" — which is the distinction the whole pipeline is
 * built around.
 */

export async function ingestionOverview() {
  const [runs, opportunities, conflicts, unsourced, externalOrgs] = await Promise.all([
    prisma.ingestionRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
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
        _count: { select: { events: true } },
      },
    }),
    prisma.fundingProgramme.findMany({
      where: { status: { in: ['PUBLISHED', 'CLOSED'] } },
      select: {
        availability: true,
        verificationStatus: true,
        lastVerifiedAt: true,
        origin: true,
        officialSource: true,
      },
    }),
    prisma.sourceConflict.count({ where: { resolvedAt: null } }),
    prisma.fundingProgramme.count({ where: { origin: 'EXTERNAL', sourceUrl: null } }),
    prisma.organisation.count({ where: { origin: 'EXTERNAL' } }),
  ]);

  const now = new Date();
  const byStatus = new Map<string, number>();
  for (const row of opportunities) {
    const shown = displayStatus(row, now);
    byStatus.set(shown, (byStatus.get(shown) ?? 0) + 1);
  }

  return {
    runs,
    sources: SOURCES.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      official: source.official,
      homepage: source.homepage,
      enabled: source.enabled,
      configured: source.listingUrls.length > 0,
      note: source.note,
    })),
    totals: {
      opportunities: opportunities.length,
      firstParty: opportunities.filter((o) => o.origin === 'FIRST_PARTY').length,
      external: opportunities.filter((o) => o.origin === 'EXTERNAL').length,
      official: opportunities.filter((o) => o.officialSource).length,
      byStatus: Object.fromEntries(byStatus),
    },
    /** Things an administrator should act on. */
    attention: {
      unresolvedConflicts: conflicts,
      /** An externally-sourced opportunity with no source is a defect. */
      withoutSource: unsourced,
      externalOrganisations: externalOrgs,
      freshnessDays: FRESHNESS_DAYS,
    },
  };
}

export async function runEvents(runId: string) {
  return prisma.ingestionEvent.findMany({
    where: { runId },
    orderBy: { createdAt: 'asc' },
    take: 500,
    select: {
      id: true,
      level: true,
      message: true,
      sourceName: true,
      sourceUrl: true,
      createdAt: true,
    },
  });
}
