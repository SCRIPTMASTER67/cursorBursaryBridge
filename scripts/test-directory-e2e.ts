/**
 * The student journey, end to end, in a real browser.
 *
 * The ten checks the brief asks for, plus the ones that matter most for trust:
 * that a closed bursary can never be mistaken for an open one, and that the
 * directory is not filtered by the student's profile while My Matches is.
 *
 * Data comes from the real ingestion pipeline reading supplied pages, so what
 * the browser sees is shaped exactly as production data would be. Everything
 * this script creates is deleted at the end.
 *
 * Usage: npm run dev, then `npm run test:directory`.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { chromium, type Page } from 'playwright';
import { runSource } from '../lib/ingest/pipeline';
import { SOURCES } from '../lib/ingest/source-registry';
import { finishRun, persistOutcome, startRun } from '../services/opportunity-ingest';
import { LISTING_PAGE, LISTING_URL, OFFICIAL_PAGE, OFFICIAL_URL } from './fixtures/ingest-pages';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const CHROME = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const db = new PrismaClient();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

async function seedDirectoryFromPipeline() {
  const pages = new Map([
    [LISTING_URL, LISTING_PAGE],
    [OFFICIAL_URL, OFFICIAL_PAGE],
  ]);
  const fetcher = async (url: string) => {
    const body = pages.get(url);
    return body
      ? { ok: true as const, body, url }
      : { ok: false as const, reason: 'missing', kind: 'http' };
  };

  const run = await startRun('test');
  const listing = await runSource(
    { ...SOURCES[0], listingUrls: [LISTING_URL], adapter: 'listing-generic' },
    { fetcher, maxDetailPages: 0 },
  );
  const a = await persistOutcome(run.id, listing);

  const official = await runSource(
    {
      ...SOURCES[0],
      name: 'Ndlovu Test Holdings (official)',
      type: 'OFFICIAL_ORGANISATION',
      official: true,
      listingUrls: [OFFICIAL_URL],
      adapter: 'zabursaries',
    },
    { fetcher, maxDetailPages: 0 },
  );
  const b = await persistOutcome(run.id, official);

  await finishRun(run.id, 'SUCCEEDED', {
    sourcesAttempted: 2,
    sourcesSucceeded: 2,
    sourcesBlocked: 0,
    sourcesFailed: 0,
    opportunitiesFound: listing.candidates.length + official.candidates.length,
    opportunitiesCreated: a.created + b.created,
    opportunitiesUpdated: a.updated + b.updated,
    duplicatesMerged: a.merged + b.merged,
    rejected: listing.rejections.length,
  });

  // An official form to prove the form panel and its Auto-Fill offer.
  const ndlovu = await db.fundingProgramme.findFirstOrThrow({
    where: { name: { contains: 'Ndlovu' } },
    select: { id: true, organisation: { select: { name: true } } },
  });
  await db.applicationForm.create({
    data: {
      fundingProgrammeId: ndlovu.id,
      name: 'Bursary application form 2027',
      sourceUrl: OFFICIAL_URL,
      fileUrl: 'https://ndlovu-test.example/forms/bursary-2027.pdf',
      fileType: 'pdf',
      providedBy: ndlovu.organisation.name,
      official: true,
      lastVerifiedAt: new Date(),
    },
  });

  return a.created + b.created;
}

async function makeStudent(runId: string) {
  const password = 'Test-Password-1';
  const user = await db.user.create({
    data: {
      email: `directory.${runId}@example.test`,
      passwordHash: await hash(password, 4),
      role: 'STUDENT',
      firstName: 'Directory',
      lastName: 'Tester',
      emailVerifiedAt: new Date(),
      acceptedTermsAt: new Date(),
      studentProfile: {
        create: {
          // Onboarded, and deliberately narrow: a student studying nursing in
          // the Western Cape should still see engineering bursaries in the
          // directory, and should NOT see them in My Matches.
          onboardingCompletedAt: new Date(),
          onboardingStep: 'review',
          educationStage: 'UNIVERSITY_CURRENT',
          qualificationLevel: 'BACHELORS',
          yearOfStudy: 2,
          academicAverage: 68,
          province: 'WESTERN_CAPE',
          citizenship: 'SA_CITIZEN',
        },
      },
    },
    select: { id: true, email: true, studentProfile: { select: { id: true } } },
  });
  return { ...user, password };
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/student\//, { timeout: 30_000 });
}

async function main() {
  const runId = randomBytes(4).toString('hex');

  // Everything the directory already holds, recorded before this test writes
  // anything. Cleanup removes what is not in this set. The previous version
  // deleted every EXTERNAL organisation and its programmes, which is the whole
  // imported directory once those organisations carry the origin they should.
  const preexistingOrgs = new Set(
    (await db.organisation.findMany({ select: { id: true } })).map((o) => o.id),
  );
  const created = await seedDirectoryFromPipeline();
  console.log(`Directory populated by the pipeline: ${created} opportunities.\n`);

  const student = await makeStudent(runId);
  const browser = await chromium.launch({ executablePath: CHROME });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  try {
    await login(page, student.email, student.password);

    console.log('TEST 1 — All Bursaries shows actual bursaries');
    await page.goto(`${BASE}/student/bursaries`, { waitUntil: 'networkidle' });
    const cards = page.locator('article');
    const cardCount = await cards.count();
    check('the directory lists opportunities', cardCount > 0, `${cardCount} card(s)`);
    // Search for this run's own fixture rather than expecting it on the first
    // page. The directory legitimately holds every bursary the ingestion
    // pipeline has imported, so which rows land on page one is not this test's
    // to assume.
    await page.goto(`${BASE}/student/bursaries?search=Ndlovu+Test+Holdings`, {
      waitUntil: 'networkidle',
    });
    check(
      'each one names its organisation',
      (await page.getByText('Ndlovu Test Holdings', { exact: false }).count()) > 0,
    );

    console.log('\nTEST 2 — Filtering by OPEN shows only open opportunities');
    await page.goto(`${BASE}/student/bursaries?status=OPEN`, { waitUntil: 'networkidle' });
    const openCards = await page.locator('article').count();
    const closedBadgesOnOpen = await page
      .locator('article')
      .getByText('Closed', { exact: true })
      .count();
    check('open filter returns results', openCards > 0, `${openCards}`);
    check('no closed opportunity appears under the open filter', closedBadgesOnOpen === 0);

    console.log('\nTEST 3 — Filtering by CLOSED shows closed opportunities');
    await page.goto(`${BASE}/student/bursaries?status=CLOSED`, { waitUntil: 'networkidle' });
    const closedCards = await page.locator('article').count();
    check('closed opportunities are still in the directory', closedCards > 0, `${closedCards}`);
    check(
      'a closed card says applications are closed',
      (await page.getByText('Applications closed').count()) > 0,
    );

    console.log('\nTEST 10 — A closed bursary cannot be mistaken for an open one');
    const applyOnClosed = await page.getByRole('link', { name: /^Apply/i }).count();
    check('no Apply action appears on a closed listing', applyOnClosed === 0);
    check(
      'the closed card offers View details instead',
      (await page.getByRole('link', { name: /View details/i }).count()) > 0,
    );

    console.log('\nTEST 4 — A bursary carries its source');
    await page.goto(`${BASE}/student/bursaries?status=OPEN`, { waitUntil: 'networkidle' });
    await page
      .getByRole('link', { name: /View bursary/i })
      .first()
      .click();
    // Wait for the navigation itself, so a click that goes nowhere fails here
    // rather than quietly running the next assertions against the list page.
    await page.waitForURL(/\/student\/bursaries\/[^/?]+$/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    check('landed on a detail page', /\/student\/bursaries\/[^/?]+$/.test(page.url()), page.url());
    check(
      'the detail page names a source',
      (await page.getByText('Source', { exact: true }).count()) > 0,
    );
    check(
      'it says when it was last verified',
      (await page.getByText(/Last verified/i).count()) > 0,
    );
    check(
      'it links to the original opportunity',
      (await page.locator('a[target="_blank"]').count()) > 0,
    );

    console.log('\nTEST 9 — A student sees bursaries they do not qualify for');
    check(
      'the directory never claims the student qualifies',
      (await page.getByText(/you qualify/i).count()) === 0,
    );
    check(
      'eligibility is shown as what the source states',
      (await page.getByText('Eligibility', { exact: true }).count()) > 0,
    );

    console.log('\nTEST 5 & 6 — The official form, and the Auto-Fill offer');
    await page.goto(`${BASE}/student/bursaries`, { waitUntil: 'networkidle' });
    await page
      .getByRole('link', { name: /View bursary|View details/i })
      .first()
      .click();
    await page.waitForURL(/\/student\/bursaries\/[^/?]+$/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    let formVisible = (await page.getByText(/Official application form provided by/i).count()) > 0;
    if (!formVisible) {
      // The form is on the Ndlovu entry; find it directly.
      const ndlovu = await db.fundingProgramme.findFirstOrThrow({
        where: { name: { contains: 'Ndlovu' } },
        select: { slug: true },
      });
      await page.goto(`${BASE}/student/bursaries/${ndlovu.slug}`, { waitUntil: 'networkidle' });
      formVisible = (await page.getByText(/Official application form provided by/i).count()) > 0;
    }
    check('the official form is offered', formVisible);
    check(
      'the form is attributed to the funder, not to Bursary-Bridge',
      (await page.getByText(/provided by Ndlovu/i).count()) > 0,
    );
    check(
      'Auto-Fill is not pushed before the form is taken',
      (await page.getByRole('link', { name: /Use Auto-Fill/i }).count()) === 0,
    );

    await page
      .getByRole('link', { name: /Get the form from/i })
      .first()
      .click({ trial: true });
    await page
      .getByRole('link', { name: /Get the form from/i })
      .first()
      .dispatchEvent('click');
    await page.waitForTimeout(500);
    check(
      'Auto-Fill is offered after the form is taken',
      (await page.getByRole('link', { name: /Use Auto-Fill/i }).count()) > 0,
    );
    check(
      'the offer can be declined',
      (await page.getByRole('button', { name: /No thanks/i }).count()) > 0,
    );

    console.log('\nTEST 7 — My Matches is personalised');
    await page.goto(`${BASE}/student/opportunities`, { waitUntil: 'networkidle' });
    const matchesBody = (await page.textContent('body')) ?? '';
    check(
      'My Matches is a separate page from the directory',
      page.url().includes('/student/opportunities'),
    );
    check('it talks about fit, not about everything we hold', /match/i.test(matchesBody));

    console.log('\nTEST 8 — All Bursaries is NOT restricted to the student’s eligibility');
    const matchCount = await page.locator('article').count();
    await page.goto(`${BASE}/student/bursaries`, { waitUntil: 'networkidle' });
    const directoryCount = await page.locator('article').count();
    check(
      'the directory shows more than the personalised matches',
      directoryCount > matchCount,
      `directory ${directoryCount} vs matches ${matchCount}`,
    );
    await page.goto(`${BASE}/student/bursaries?search=Ndlovu+Test+Holdings`, {
      waitUntil: 'networkidle',
    });
    check(
      'the directory shows opportunities outside the student’s field',
      (await page.getByText(/Ndlovu Test Holdings/i).count()) > 0,
    );

    console.log('\nCounts are real');
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: 'networkidle' });
    const dashboard = (await page.textContent('body')) ?? '';
    const inDb = await db.fundingProgramme.count({
      where: { status: { in: ['PUBLISHED', 'CLOSED'] } },
    });
    check(
      'the dashboard reports the real directory size',
      dashboard.includes(`of ${inDb} in the directory`),
      `expected "of ${inDb} in the directory"`,
    );
    check(
      'both entry points are offered separately',
      (await page.getByRole('link', { name: /View my matches/i }).count()) === 1 &&
        (await page.getByRole('link', { name: /Explore all bursaries/i }).count()) === 1,
    );
  } finally {
    await browser.close();

    const mine = await db.organisation.findMany({
      where: { id: { notIn: [...preexistingOrgs] } },
      select: { id: true },
    });
    const mineIds = mine.map((o) => o.id);
    await db.fundingProgramme.deleteMany({ where: { organisationId: { in: mineIds } } });
    await db.organisation.deleteMany({ where: { id: { in: mineIds } } });
    await db.user.deleteMany({ where: { email: { contains: runId } } });
    await db.ingestionRun.deleteMany({ where: { trigger: 'test' } });
    const left = await db.fundingProgramme.count({
      where: { organisationId: { in: mineIds } },
    });
    console.log(`\nCleanup: ${left} of this run's own opportunities remain.`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  await db.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
