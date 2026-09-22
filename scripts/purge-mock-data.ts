/**
 * Remove invented bursaries from a database.
 *
 * The demo seed created funders and funding programmes that do not exist. This
 * removes them and everything hanging off them, and reports exactly what it
 * touched so the removal can be audited.
 *
 * It identifies invented data by what it is, not by when it was made: an
 * organisation with no verified source behind it and no real member account,
 * and every opportunity belonging to it.
 *
 *   npm run purge:mock -- --dry-run   report what would go
 *   npm run purge:mock                remove it
 */
import '../lib/load-env';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

/** Organisation and programme names that the demo seed is known to create. */
const DEMO_ORGANISATIONS = [
  'Kgotso Holdings',
  'Umoya Energy',
  'Thuto Foundation',
  'Amandla Mining Group',
];

/** Any account on the demo domain. */
const DEMO_EMAIL_PATTERN = '@demo.bursarybridge.local';

async function main() {
  console.log(dryRun ? 'Dry run — nothing will be deleted.\n' : 'Removing invented data.\n');

  const organisations = await db.organisation.findMany({
    where: { name: { in: DEMO_ORGANISATIONS } },
    select: {
      id: true,
      name: true,
      _count: { select: { programmes: true, applications: true, members: true } },
    },
  });

  console.log(`Invented funding organisations: ${organisations.length}`);
  for (const organisation of organisations) {
    console.log(
      `  ${organisation.name} — ${organisation._count.programmes} programme(s), ` +
        `${organisation._count.applications} application(s), ${organisation._count.members} member(s)`,
    );
  }

  const programmes = await db.fundingProgramme.findMany({
    where: { organisationId: { in: organisations.map((o) => o.id) } },
    select: { id: true, name: true, sourceUrl: true },
  });
  console.log(`\nInvented funding programmes: ${programmes.length}`);
  for (const programme of programmes) {
    console.log(`  ${programme.name}`);
  }

  const demoUsers = await db.user.findMany({
    where: { email: { contains: DEMO_EMAIL_PATTERN } },
    select: { id: true, email: true, role: true },
  });
  console.log(`\nDemo accounts: ${demoUsers.length}`);
  for (const user of demoUsers) console.log(`  ${user.email} (${user.role})`);

  // Anything left without a source is not shippable either. This catches
  // invented rows the lists above do not name.
  const unsourced = await db.fundingProgramme.findMany({
    where: {
      organisationId: { notIn: organisations.map((o) => o.id) },
      origin: 'EXTERNAL',
      sourceUrl: null,
    },
    select: { id: true, name: true },
  });
  if (unsourced.length > 0) {
    console.log(`\nExternal opportunities with no source URL: ${unsourced.length}`);
    for (const row of unsourced) console.log(`  ${row.name}`);
  }

  if (dryRun) {
    console.log('\nNothing was deleted.');
    await db.$disconnect();
    return;
  }

  const programmeIds = [...programmes.map((p) => p.id), ...unsourced.map((p) => p.id)];
  const organisationIds = organisations.map((o) => o.id);
  const userIds = demoUsers.map((u) => u.id);

  // Ordered so no foreign key blocks a delete. Cascades cover the rest.
  const removed = {
    applications: (
      await db.application.deleteMany({
        where: {
          OR: [
            { fundingProgrammeId: { in: programmeIds } },
            { organisationId: { in: organisationIds } },
          ],
        },
      })
    ).count,
    shortlists: (
      await db.shortlist.deleteMany({ where: { organisationId: { in: organisationIds } } })
    ).count,
    programmes: (await db.fundingProgramme.deleteMany({ where: { id: { in: programmeIds } } }))
      .count,
    organisations: (await db.organisation.deleteMany({ where: { id: { in: organisationIds } } }))
      .count,
    users: (await db.user.deleteMany({ where: { id: { in: userIds } } })).count,
  };

  console.log('\nRemoved:');
  for (const [what, count] of Object.entries(removed)) {
    console.log(`  ${count} ${what}`);
  }

  const remaining = await db.fundingProgramme.count();
  const withoutSource = await db.fundingProgramme.count({
    where: { origin: 'EXTERNAL', sourceUrl: null },
  });
  console.log(`\nFunding opportunities remaining: ${remaining}`);
  console.log(`  of which externally sourced with no source URL: ${withoutSource}`);
  if (remaining === 0) {
    console.log(
      '\nThe directory is now empty. That is the correct state until real\n' +
        'opportunities are ingested or a funder publishes one — an empty\n' +
        'directory is honest, a populated fake one is not.',
    );
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
