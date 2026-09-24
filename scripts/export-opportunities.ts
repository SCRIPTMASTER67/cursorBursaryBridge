/**
 * Export the ingested opportunities as a loadable snapshot.
 *
 * Reading the sources takes hours, because their robots.txt asks for thirty
 * seconds between requests and the pipeline honours it. That is the right
 * behaviour for a crawler and the wrong experience for somebody who just wants
 * to see the product working, so a run's results can be written out here and
 * loaded elsewhere in seconds.
 *
 * What travels is what was read: the opportunity, and the source URL and
 * verification date it was read from. A snapshot row is therefore still
 * checkable against the page it came from — which is the property that
 * separates this from a seed file full of invented bursaries.
 *
 * Usage: npm run export:opportunities [-- path/to/file.json]
 */
import '../lib/load-env';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const out = process.argv[2] ?? 'prisma/opportunities-snapshot.json';

async function main() {
  const programmes = await db.fundingProgramme.findMany({
    where: { origin: 'EXTERNAL' },
    orderBy: { name: 'asc' },
    include: {
      // sourceUrl travels with the funder, not just with the opportunity:
      // it is what marks the funder as one a source named rather than one
      // that registered, and a snapshot that drops it restores a directory
      // the production audit then reports as unattributed.
      organisation: {
        select: { name: true, type: true, industry: true, website: true, sourceUrl: true },
      },
      sources: {
        select: {
          url: true,
          name: true,
          type: true,
          official: true,
          isPrimary: true,
          firstSeenAt: true,
          lastCheckedAt: true,
          lastVerifiedAt: true,
        },
      },
    },
  });

  const snapshot = {
    exportedAt: new Date().toISOString(),
    note:
      'Collected by the Bursary-Bridge ingestion pipeline from the sources named on each row. ' +
      'Every opportunity carries the URL it was read from and the date it was last confirmed. ' +
      'Nothing here was written by hand.',
    count: programmes.length,
    opportunities: programmes.map((programme) => ({
      name: programme.name,
      slug: programme.slug,
      shortDescription: programme.shortDescription,
      fullDescription: programme.fullDescription,
      fundingType: programme.fundingType,
      coverage: programme.coverage,
      openDate: programme.openDate,
      closingDate: programme.closingDate,
      deadlineKind: programme.deadlineKind,
      deadlineNote: programme.deadlineNote,
      availability: programme.availability,
      applicationUrl: programme.applicationUrl,
      sourceUrl: programme.sourceUrl,
      sourceName: programme.sourceName,
      sourceType: programme.sourceType,
      officialSource: programme.officialSource,
      verificationStatus: programme.verificationStatus,
      lastVerifiedAt: programme.lastVerifiedAt,
      lastCheckedAt: programme.lastCheckedAt,
      dedupeKey: programme.dedupeKey,
      organisation: programme.organisation,
      sources: programme.sources,
    })),
  };

  writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${programmes.length} opportunities to ${out}`);

  const open = programmes.filter((p) => p.availability === 'OPEN').length;
  console.log(`  ${open} open, ${programmes.length - open} closed, upcoming or unknown`);
  console.log('  every row carries the source URL it was read from');

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
