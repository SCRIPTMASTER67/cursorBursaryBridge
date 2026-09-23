/**
 * Production seed.
 *
 * Creates reference data and nothing else: the public South African
 * institutions and the standardised course catalogue that the profile and
 * eligibility forms choose from, plus the platform administrator account.
 *
 * It deliberately creates NO bursaries, NO funding organisations and NO
 * applications. Those come from two places only — a funder publishing their
 * own programme here, or the ingestion pipeline reading a real source — and
 * neither of them is a seed file. An empty directory is the correct state for
 * a database that has not ingested anything yet; a populated one would be a
 * database full of bursaries that do not exist.
 *
 * Demo data for local development lives in `prisma/seed-demo.ts` and refuses
 * to run unless it is asked for by name.
 */
import '../lib/load-env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { institutions, programmes } from './seed-data';
import { subjects } from './subject-data';
import { canonicalise } from '../lib/catalogue';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@bursarybridge.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function main() {
  console.log('Seeding reference data…');

  // The catalogue is upserted rather than replaced, so reseeding a live
  // database cannot orphan a student's chosen institution or course.
  let institutionsAdded = 0;
  for (const institution of institutions) {
    const existing = await prisma.institution.findUnique({
      where: { name: institution.name },
      select: { id: true },
    });
    if (existing) {
      await prisma.institution.update({
        where: { id: existing.id },
        data: { ...institution, canonicalName: canonicalise(institution.name) },
      });
    } else {
      await prisma.institution.create({
        data: { ...institution, canonicalName: canonicalise(institution.name) },
      });
      institutionsAdded += 1;
    }
  }

  let coursesAdded = 0;
  for (const programme of programmes) {
    const existing = await prisma.programme.findUnique({
      where: { name: programme.name },
      select: { id: true },
    });
    if (existing) {
      await prisma.programme.update({
        where: { id: existing.id },
        data: { ...programme, canonicalName: canonicalise(programme.name) },
      });
    } else {
      await prisma.programme.create({
        data: { ...programme, canonicalName: canonicalise(programme.name) },
      });
      coursesAdded += 1;
    }
  }

  // The National Senior Certificate subject list. Real subjects, so a bursary
  // requiring "Mathematics" finds a student's Mathematics mark rather than a
  // differently-spelled row. No tertiary modules are seeded: module names
  // differ at every institution and there is no national list to draw on, so
  // students type their own and those become custom catalogue entries.
  let subjectsAdded = 0;
  for (const subject of subjects) {
    const canonicalName = canonicalise(subject.name);
    const existing = await prisma.subjectCatalogue.findUnique({
      where: { canonicalName },
      select: { id: true },
    });
    if (existing) {
      await prisma.subjectCatalogue.update({
        where: { id: existing.id },
        data: { name: subject.name, level: subject.level, custom: false },
      });
    } else {
      await prisma.subjectCatalogue.create({
        data: { name: subject.name, canonicalName, level: subject.level, custom: false },
      });
      subjectsAdded += 1;
    }
  }

  console.log(`  institutions: ${institutions.length} in catalogue (${institutionsAdded} new)`);
  console.log(`  courses:      ${programmes.length} in catalogue (${coursesAdded} new)`);
  console.log(`  subjects:     ${subjects.length} in catalogue (${subjectsAdded} new)`);

  // There is no public sign-up for the ADMIN role, so the first administrator
  // has to be created here. A password must be supplied: a default one would
  // be a published credential.
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });

  if (existingAdmin) {
    console.log(`  administrator: ${ADMIN_EMAIL} already exists, left untouched`);
  } else if (!ADMIN_PASSWORD) {
    console.log(
      `  administrator: not created. Set ADMIN_PASSWORD (and optionally ADMIN_EMAIL)\n` +
        `                 and run this again to create the first administrator.`,
    );
  } else if (ADMIN_PASSWORD.length < 12) {
    console.error('  administrator: ADMIN_PASSWORD must be at least 12 characters. Not created.');
    process.exitCode = 1;
  } else {
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
        role: 'ADMIN',
        firstName: 'Platform',
        lastName: 'Administrator',
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
      },
    });
    console.log(`  administrator: created ${ADMIN_EMAIL}`);
  }

  const opportunities = await prisma.fundingProgramme.count();
  console.log(`\nFunding opportunities in the database: ${opportunities}`);
  if (opportunities === 0) {
    console.log(
      'That is expected on a fresh database. Opportunities come from a funder\n' +
        'publishing one here, or from `npm run ingest` reading a real source.\n' +
        'None are seeded, because a seeded bursary is an invented bursary.',
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
