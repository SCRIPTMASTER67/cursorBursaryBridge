/**
 * Load an exported snapshot of ingested opportunities.
 *
 * The counterpart to `export:opportunities`. It exists so somebody can see the
 * product working against real data without first spending three hours
 * crawling: the sources ask for thirty seconds between requests, and honouring
 * that is not negotiable, but nobody should have to wait through it twice.
 *
 * What it loads is what was read from the sources, source URLs and
 * verification dates included, so every row remains checkable against the page
 * it came from. It is emphatically not a seed of invented bursaries: it
 * refuses to load a row with no source URL, because an opportunity that cannot
 * be traced back to a page is exactly the thing this project does not ship.
 *
 * Re-runnable: an opportunity already held is updated rather than duplicated.
 *
 * Usage: npm run import:snapshot [-- path/to/file.json]
 */
import '../lib/load-env';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const file = process.argv[2] ?? 'prisma/opportunities-snapshot.json';

type SnapshotRow = {
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  fundingType: string;
  coverage: string[];
  openDate: string | null;
  closingDate: string | null;
  deadlineKind: string;
  deadlineNote: string | null;
  availability: string;
  applicationUrl: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  sourceType: string | null;
  officialSource: boolean;
  verificationStatus: string;
  lastVerifiedAt: string | null;
  lastCheckedAt: string | null;
  dedupeKey: string | null;
  organisation: {
    name: string;
    type: string;
    industry: string;
    website: string | null;
    sourceUrl?: string | null;
  };
  sources: {
    url: string;
    name: string;
    type: string;
    official: boolean;
    isPrimary: boolean;
    firstSeenAt: string;
    lastCheckedAt: string | null;
    lastVerifiedAt: string | null;
  }[];
};

async function main() {
  const snapshot = JSON.parse(readFileSync(file, 'utf8')) as {
    exportedAt: string;
    count: number;
    opportunities: SnapshotRow[];
  };

  console.log(
    `Loading ${snapshot.count} opportunities collected on ${snapshot.exportedAt.slice(0, 10)}.`,
  );

  let created = 0;
  let updated = 0;
  let refused = 0;

  for (const row of snapshot.opportunities) {
    // The rule this whole project runs on: no source, no opportunity.
    if (!row.sourceUrl) {
      refused += 1;
      console.log(`  refused "${row.name}": no source URL`);
      continue;
    }

    // EXTERNAL, for the same reason the ingestion pipeline records it that
    // way: this funder was named by a published source and has no account
    // here, and nothing downstream may mistake it for one that registered.
    // The column defaults to REGISTERED, so leaving it off here quietly turned
    // every restored funder into a registered one.
    //
    // `update` stays empty on purpose. A funder that really did register, and
    // that a source later names as well, keeps the origin it earned.
    const organisation = await db.organisation.upsert({
      where: { name: row.organisation.name },
      update: {},
      create: {
        name: row.organisation.name,
        type: row.organisation.type as never,
        industry: row.organisation.industry as never,
        website: row.organisation.website,
        origin: 'EXTERNAL',
        // Snapshots taken before the exporter carried this field have no
        // organisation sourceUrl, so fall back to the page the opportunity
        // itself was read from. Both name the same source.
        sourceUrl: row.organisation.sourceUrl ?? row.sourceUrl,
      },
      select: { id: true },
    });

    const existing = await db.fundingProgramme.findFirst({
      where: row.dedupeKey ? { dedupeKey: row.dedupeKey } : { slug: row.slug },
      select: { id: true },
    });

    const data = {
      organisationId: organisation.id,
      name: row.name,
      slug: row.slug,
      shortDescription: row.shortDescription,
      fullDescription: row.fullDescription,
      fundingType: row.fundingType as never,
      coverage: row.coverage as never,
      openDate: row.openDate ? new Date(row.openDate) : null,
      closingDate: row.closingDate ? new Date(row.closingDate) : null,
      deadlineKind: row.deadlineKind as never,
      deadlineNote: row.deadlineNote,
      status: 'PUBLISHED' as const,
      origin: 'EXTERNAL' as const,
      availability: row.availability as never,
      applicationUrl: row.applicationUrl,
      sourceUrl: row.sourceUrl,
      sourceName: row.sourceName,
      sourceType: row.sourceType as never,
      officialSource: row.officialSource,
      verificationStatus: row.verificationStatus as never,
      lastVerifiedAt: row.lastVerifiedAt ? new Date(row.lastVerifiedAt) : null,
      lastCheckedAt: row.lastCheckedAt ? new Date(row.lastCheckedAt) : null,
      dedupeKey: row.dedupeKey,
    };

    const programme = existing
      ? await db.fundingProgramme.update({ where: { id: existing.id }, data, select: { id: true } })
      : await db.fundingProgramme.create({ data, select: { id: true } });

    if (existing) updated += 1;
    else created += 1;

    for (const source of row.sources) {
      await db.opportunitySource.upsert({
        where: { fundingProgrammeId_url: { fundingProgrammeId: programme.id, url: source.url } },
        update: {
          lastCheckedAt: source.lastCheckedAt ? new Date(source.lastCheckedAt) : null,
          lastVerifiedAt: source.lastVerifiedAt ? new Date(source.lastVerifiedAt) : null,
        },
        create: {
          fundingProgrammeId: programme.id,
          url: source.url,
          name: source.name,
          type: source.type as never,
          official: source.official,
          isPrimary: source.isPrimary,
          firstSeenAt: new Date(source.firstSeenAt),
          lastCheckedAt: source.lastCheckedAt ? new Date(source.lastCheckedAt) : null,
          lastVerifiedAt: source.lastVerifiedAt ? new Date(source.lastVerifiedAt) : null,
        },
      });
    }
  }

  console.log(`\n${created} created, ${updated} updated, ${refused} refused.`);
  console.log('Every one carries the URL it was read from. Open any bursary to see it.');
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
