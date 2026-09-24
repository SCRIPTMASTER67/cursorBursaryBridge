/**
 * The motivational letter journey, end to end, in a real browser.
 *
 * A page that renders is not a feature. What is checked here is the whole
 * loop a student actually walks: open the letters page with nothing on it,
 * choose a real published bursary, answer the questions in their own words,
 * generate, read the draft, edit it, save it, and download the PDF — and that
 * what comes back contains their sentences and their marks, and nothing that
 * was invented for them.
 *
 * Usage: npm start (or npm run dev), then `npm run test:letters:ui`.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { chromium, type Page } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const CHROME = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
/**
 * A distinct client address for this run.
 *
 * The login limiter buckets by address as well as by account. Every browser
 * suite drives a real Chromium against localhost, so they all arrive from the
 * same address and a full run -- or a second run inside the window -- trips
 * the per-address allowance and fails at the sign-in step, which looks like a
 * broken login and is not. Real users do not share an address, so neither do
 * these runs; the per-account limit, the one that stops credential stuffing,
 * still applies untouched.
 */
const CLIENT_IP = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

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

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/student\//, { timeout: 30_000 });
}

async function main() {
  const tag = randomBytes(4).toString('hex');
  const password = 'Test-Password-1';
  let orgId = '';
  let institutionId = '';
  let courseId = '';
  let subjectId = '';
  let browser;

  try {
    const institution = await db.institution.create({
      data: {
        name: `Letters University ${tag}`,
        canonicalName: `letters university ${tag}`,
        type: 'UNIVERSITY',
        province: 'GAUTENG',
        city: 'Pretoria',
      },
      select: { id: true },
    });
    institutionId = institution.id;

    const course = await db.programme.create({
      data: {
        name: `Letters Engineering ${tag}`,
        canonicalName: `letters engineering ${tag}`,
        field: 'ENGINEERING',
      },
      select: { id: true },
    });
    courseId = course.id;

    const subject = await db.subjectCatalogue.create({
      data: { name: `Mathematics ${tag}`, canonicalName: `mathematics ${tag}`, level: 'SCHOOL' },
      select: { id: true },
    });
    subjectId = subject.id;

    const org = await db.organisation.create({
      data: { name: `Letters Funder ${tag}`, type: 'CORPORATION', industry: 'ENERGY' },
      select: { id: true },
    });
    orgId = org.id;

    await db.fundingProgramme.create({
      data: {
        organisationId: orgId,
        name: `Letters Bursary ${tag}`,
        slug: `letters-bursary-${tag}`,
        shortDescription: 'x',
        fullDescription: 'x',
        fundingType: 'BURSARY',
        coverage: ['TUITION_FEES'],
        status: 'PUBLISHED',
        availability: 'OPEN',
        closingDate: new Date(Date.now() + 60 * 86_400_000),
        supportedProgrammes: { create: [{ programmeId: courseId }] },
        eligibility: {
          create: {
            minAcademicAverage: 65,
            subjectRequirements: { create: [{ subjectId, minimumPercentage: 70 }] },
          },
        },
      },
    });

    const student = await db.user.create({
      data: {
        email: `letters.ui.${tag}@example.test`,
        passwordHash: await hash(password, 4),
        role: 'STUDENT',
        firstName: 'Nomsa',
        lastName: 'Khumalo',
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        studentProfile: {
          create: {
            onboardingCompletedAt: new Date(),
            onboardingStep: 'review',
            educationStage: 'UNIVERSITY_CURRENT',
            qualificationLevel: 'BACHELORS',
            currentInstitutionId: institutionId,
            currentProgrammeId: courseId,
            yearOfStudy: 2,
            academicAverage: 74,
            province: 'GAUTENG',
            citizenship: 'SA_CITIZEN',
            householdIncome: 'BELOW_50K',
            subjectResults: {
              create: [{ subjectId, percentage: 82, year: 2025, kind: 'FINAL', level: 'SCHOOL' }],
            },
          },
        },
      },
      select: { email: true },
    });

    browser = await chromium.launch({ executablePath: CHROME });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { 'x-forwarded-for': CLIENT_IP },
    });
    const page = await context.newPage();
    await login(page, student.email, password);

    console.log('TEST 1 — An empty letters page says what to do next');
    await page.goto(`${BASE}/student/letters`, { waitUntil: 'networkidle' });
    check('the page loads', page.url().includes('/student/letters'));
    check(
      'it explains itself rather than showing an empty box',
      (await page.getByText('You have not written a letter yet').count()) > 0,
    );
    check(
      'and offers the way forward',
      (await page.getByRole('link', { name: /write my first letter/i }).count()) > 0,
    );

    console.log('\nTEST 2 — The bursary being written to is a real published one');
    await page.goto(`${BASE}/student/letters/new`, { waitUntil: 'networkidle' });
    const options = await page.locator('select option').allTextContents();
    check(
      'the published bursary is offered',
      options.some((option) => option.includes(`Letters Bursary ${tag}`)),
      options.join(' | ').slice(0, 120),
    );
    check(
      'and a bursary found elsewhere can be named instead',
      options.some((option) => /another bursary/i.test(option)),
    );
    await page.selectOption('select', { label: `Letters Bursary ${tag} — Letters Funder ${tag}` });
    await page.getByRole('button', { name: /continue/i }).click();

    console.log('\nTEST 3 — The student answers in their own words');
    const boxes = page.locator('textarea');
    check('every question has a box', (await boxes.count()) === 7, `${await boxes.count()}`);
    const ownWords = 'I want to work on rural electrification after I qualify';
    await boxes.nth(0).fill('Eskom trains the engineers who keep the grid running');
    await boxes.nth(2).fill(ownWords);
    await page.getByRole('button', { name: /continue/i }).click();

    console.log('\nTEST 4 — What the letter will use is shown before it is written');
    check('the course is named', (await page.getByText(`Letters Engineering ${tag}`).count()) > 0);
    check('the average is shown', (await page.getByText('74%').count()) > 0);
    check(
      'the institution is shown',
      (await page.getByText(`Letters University ${tag}`).count()) > 0,
    );

    console.log('\nTEST 5 — The draft is written from those facts and those words');
    await page.getByRole('button', { name: /write my draft/i }).click();
    await page.waitForURL(/\/student\/letters\/[a-z0-9]+$/, { timeout: 30_000 });
    const draft = await page.locator('textarea').first().inputValue();
    check('the draft is not empty', draft.length > 200, `${draft.length} characters`);
    check('it addresses the funder', draft.includes(`Letters Funder ${tag}`));
    check('it signs with the student', draft.includes('Nomsa Khumalo'));
    check('it uses the student’s own sentence', draft.includes(ownWords));
    check('it cites the mark the student entered', draft.includes('82%'));
    check('it names the requirement that mark was measured against', draft.includes('70%'));
    check(
      'it invents no achievement',
      !/passionate|always dreamed|volunteer|captain of/i.test(draft),
    );
    check('no unfilled placeholder survives', !/\[|\]|TBC|XXX|Lorem/i.test(draft));

    console.log('\nTEST 6 — The student can edit and save');
    const edited = `${draft}\n\nP.S. I have attached my latest results.`;
    await page.locator('textarea').first().fill(edited);
    await page.getByRole('button', { name: /^save$/i }).click();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 30_000 });
    const reloaded = await page.locator('textarea').first().inputValue();
    check('the edit survives a reload', reloaded.includes('P.S. I have attached'));

    console.log('\nTEST 7 — The download is a real PDF');
    const pdf = await page.request.get(
      `${BASE}${new URL(page.url()).pathname.replace('/student/letters/', '/api/student/letters/')}/pdf`,
    );
    check('the download responds', pdf.status() === 200, `status ${pdf.status()}`);
    check(
      'it is served as a PDF',
      (pdf.headers()['content-type'] ?? '').includes('application/pdf'),
    );
    const body = await pdf.body();
    check('it starts with the PDF header', body.subarray(0, 5).toString('latin1') === '%PDF-');
    check('it has real content', body.byteLength > 800, `${body.byteLength} bytes`);

    console.log('\nTEST 8 — The letter now appears in the history');
    await page.goto(`${BASE}/student/letters`, { waitUntil: 'networkidle' });
    check('it is listed', (await page.getByText(`Letters Bursary ${tag}`).count()) > 0);
    check('and is shown as a draft', (await page.getByText('Draft', { exact: true }).count()) > 0);
    check(
      'and is marked as edited by the student',
      (await page.getByText('Edited by you').count()) > 0,
    );

    console.log('\nTEST 9 — The feature is reachable from where a student applies');
    const programme = await db.fundingProgramme.findFirstOrThrow({
      where: { organisationId: orgId },
      select: { id: true },
    });
    await page.goto(`${BASE}/student/opportunities/${programme.id}`, { waitUntil: 'networkidle' });
    const letterLink = page.getByRole('link', { name: /write a motivational letter/i });
    check('the opportunity page offers to write one', (await letterLink.count()) > 0);
    if ((await letterLink.count()) > 0) {
      await letterLink.first().click();
      await page.waitForURL(/\/student\/letters\/new/, { timeout: 30_000 });
      check('and arrives with that bursary already chosen', page.url().includes(programme.id));
    }
  } finally {
    if (browser) await browser.close();
    await db.motivationalLetter.deleteMany({ where: { opportunityName: { contains: tag } } });
    await db.fundingProgramme.deleteMany({ where: { organisationId: orgId } });
    await db.organisation.deleteMany({ where: { id: orgId } });
    await db.user.deleteMany({ where: { email: { contains: tag } } });
    await db.subjectCatalogue.deleteMany({ where: { id: subjectId } });
    await db.programme.deleteMany({ where: { id: courseId } });
    await db.institution.deleteMany({ where: { id: institutionId } });
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
