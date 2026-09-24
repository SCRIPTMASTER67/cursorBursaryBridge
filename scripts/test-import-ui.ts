/**
 * Bulk application intake, end to end, in a real browser.
 *
 * A wired-up screen is not a feature. What is checked here is the whole loop a
 * funder actually walks: open Imports with nothing in it, choose a programme,
 * drop a pile of application forms on the page, watch them being read, review
 * what the extractor proposed, leave one out, confirm — and then find exactly
 * the applicants they chose in the Applications list, with the ones they did
 * not choose absent, the unreadable file still listed with its reason, and the
 * original document still downloadable.
 *
 * Usage: npm run dev, then `npm run test:import:ui`.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import { chromium, type Page } from 'playwright';
import { buildSourceForm } from './fixtures/bursary-forms';

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

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/corporate\//, { timeout: 30_000 });
}

/**
 * The completed source form, filled in for a different applicant.
 *
 * Every identifying field is changed, not just the name. Changing the name
 * alone leaves the identity number, email and mobile shared, and duplicate
 * detection then correctly reports two people as the same one -- which is the
 * detector working, and a fixture that lies about what it is testing.
 */
async function variant(
  first: string,
  last: string,
  identity: { idNumber: string; email: string; mobile: string },
): Promise<Uint8Array> {
  const base = await buildSourceForm();
  const doc = await PDFDocument.load(base);
  const form = doc.getForm();
  form.getTextField('First Name').setText(first);
  form.getTextField('Surname').setText(last);
  form.getTextField('ID Number').setText(identity.idNumber);
  form.getTextField('Email Address').setText(identity.email);
  form.getTextField('Cellphone Number').setText(identity.mobile);
  return doc.save();
}

async function main() {
  const tag = randomBytes(4).toString('hex');
  const password = 'Test-Password-1';
  let orgId = '';
  let browser;

  try {
    const organisation = await db.organisation.create({
      data: {
        name: `Import Test Trust ${tag}`,
        type: 'CORPORATION',
        industry: 'OTHER',
        origin: 'REGISTERED',
      },
      select: { id: true },
    });
    orgId = organisation.id;

    await db.user.create({
      data: {
        email: `import.${tag}@example.test`,
        passwordHash: await hash(password, 10),
        firstName: 'Thandi',
        lastName: 'Reviewer',
        role: 'CORPORATE',
        emailVerifiedAt: new Date(),
        corporateProfile: { create: { organisationId: orgId, onboardingCompletedAt: new Date() } },
      },
    });

    const programme = await db.fundingProgramme.create({
      data: {
        organisationId: orgId,
        name: `Import Test Bursary ${tag}`,
        slug: `import-test-${tag}`,
        shortDescription: 'A programme used to exercise bulk intake.',
        fullDescription: 'A programme used to exercise bulk application intake.',
        fundingType: 'BURSARY',
        coverage: ['TUITION_FEES'],
        status: 'PUBLISHED',
        origin: 'FIRST_PARTY',
        eligibility: { create: {} },
      },
      select: { id: true },
    });

    // Three readable forms, two of them the same applicant so duplicate
    // detection has something to find, plus a file that is not a PDF at all.
    const dir = mkdtempSync(join(tmpdir(), 'import-ui-'));
    const amara = {
      idNumber: '0207145678082',
      email: `amara.${tag}@example.ac.za`,
      mobile: '072 555 0101',
    };
    const sipho = {
      idNumber: '0109205678081',
      email: `sipho.${tag}@example.ac.za`,
      mobile: '072 555 0202',
    };
    const files = [
      ['amara-dlamini.pdf', await variant('Amara', `Dlamini${tag}`, amara)],
      ['sipho-khumalo.pdf', await variant('Sipho', `Khumalo${tag}`, sipho)],
      // The same person, sent twice: the case duplicate detection is for.
      ['sipho-khumalo-copy.pdf', await variant('Sipho', `Khumalo${tag}`, sipho)],
    ] as const;
    for (const [name, bytes] of files) writeFileSync(join(dir, name), bytes);
    writeFileSync(join(dir, 'not-a-form.pdf'), 'this is not a pdf at all');

    browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await login(page, `import.${tag}@example.test`, password);

    console.log('\nImports starts empty and explains itself');
    await page.goto(`${BASE}/corporate/imports`, { waitUntil: 'networkidle' });
    const emptyBody = (await page.textContent('body')) ?? '';
    check('the empty state is shown', /No imports yet/i.test(emptyBody));
    check(
      'it says nothing is imported without confirmation',
      /nothing becomes an applicant until you confirm/i.test(emptyBody),
    );

    console.log('\nUploading a batch');
    await page.goto(`${BASE}/corporate/imports/new`, { waitUntil: 'networkidle' });
    await page.selectOption('select', { label: `Import Test Bursary ${tag}` });
    await page.setInputFiles('input[type="file"]', [
      join(dir, 'amara-dlamini.pdf'),
      join(dir, 'sipho-khumalo.pdf'),
      join(dir, 'sipho-khumalo-copy.pdf'),
      join(dir, 'not-a-form.pdf'),
    ]);
    const listed = (await page.textContent('body')) ?? '';
    check('the chosen files are listed before upload', /4 files ready/i.test(listed));

    await page.click('button:has-text("Upload")');
    // Not just any /imports/ URL: /imports/new is where we started, and
    // matching it would let the wait resolve before the upload finished.
    await page.waitForURL(/\/corporate\/imports\/(?!new$)[^/]+$/, { timeout: 120_000 });
    const batchId = new URL(page.url()).pathname.split('/').filter(Boolean).pop() ?? '';
    check('the browser lands on the batch', batchId.length > 10, page.url());

    console.log('\nExtraction runs and the review table appears');
    await page.waitForSelector('text=/selected to import/i', { timeout: 120_000 });
    const reviewBody = (await page.textContent('body')) ?? '';
    check('a readable applicant is named', reviewBody.includes(`Dlamini${tag}`));
    check('the duplicate is flagged, not removed', /Possible duplicate/i.test(reviewBody));
    check('the unreadable file is kept and explained', /Could not be read/i.test(reviewBody));

    // The duplicate's explanation lives in its expanded detail, which is where
    // a reviewer reads it, so the row is opened rather than the summary read.
    await page.click('button:has-text("sipho-khumalo-copy.pdf")');
    await page.waitForSelector('text=/Nothing has been merged or removed/i', { timeout: 10_000 });
    check('it says a duplicate was not merged', true);

    const batch = await db.applicationImportBatch.findUniqueOrThrow({
      where: { id: batchId },
      select: { totalFiles: true, failedCount: true, duplicateCount: true, status: true },
    });
    check('all four files are accounted for', batch.totalFiles === 4, String(batch.totalFiles));
    check('the unreadable one is recorded as failed', batch.failedCount === 1);
    check('one duplicate was detected', batch.duplicateCount === 1, String(batch.duplicateCount));
    check('the batch waits for a person', batch.status === 'READY_FOR_REVIEW', batch.status);

    console.log('\nThe original document is still the original');
    const original = await page.request.get(
      `${BASE}/api/corporate/imports/${batchId}/file/${
        (
          await db.applicationImportFile.findFirstOrThrow({
            where: { batchId, status: 'READY' },
            select: { id: true },
          })
        ).id
      }`,
    );
    check('the uploaded form can be downloaded', original.ok());
    check(
      'and it is still a PDF',
      (await original.body()).subarray(0, 4).toString() === '%PDF',
    );

    console.log('\nExport carries the extraction, not a summary of it');
    const csv = await page.request.get(`${BASE}/api/corporate/imports/${batchId}/export`);
    const csvText = await csv.text();
    check('the CSV downloads', csv.ok());
    check('it names the applicant', csvText.includes(`Dlamini${tag}`));
    check('it carries the file name for tracing', csvText.includes('amara-dlamini.pdf'));

    console.log('\nA field can be corrected without losing what the form said');
    const field = await db.importExtractedField.findFirstOrThrow({
      where: { file: { batchId, status: 'READY' }, canonicalKey: 'city' },
      select: { id: true, value: true },
    });
    const patch = await page.request.patch(
      `${BASE}/api/corporate/imports/${batchId}/fields/${field.id}`,
      { data: { value: 'Richards Bay' } },
    );
    check('the correction is accepted', patch.ok(), String(patch.status()));
    const corrected = await db.importExtractedField.findUniqueOrThrow({
      where: { id: field.id },
      select: { value: true, correctedValue: true, correctedById: true, correctedAt: true },
    });
    check('the correction is stored', corrected.correctedValue === 'Richards Bay');
    check('what the form said is kept', corrected.value === field.value, corrected.value);
    check('who corrected it is recorded', Boolean(corrected.correctedById && corrected.correctedAt));

    const cleared = await page.request.patch(
      `${BASE}/api/corporate/imports/${batchId}/fields/${field.id}`,
      { data: { value: '' } },
    );
    check('clearing it is accepted', cleared.ok());
    const restored = await db.importExtractedField.findUniqueOrThrow({
      where: { id: field.id },
      select: { correctedValue: true, correctedById: true },
    });
    check(
      'clearing restores the reading rather than storing an empty correction',
      restored.correctedValue === null && restored.correctedById === null,
    );

    console.log('\nA finished batch cannot be resumed');
    const noResume = await page.request.post(`${BASE}/api/corporate/imports/${batchId}/resume`);
    check(
      'resuming a fully-read batch is refused',
      noResume.status() === 409,
      String(noResume.status()),
    );

    console.log('\nConfirming imports only what was chosen');
    // The duplicate starts unselected; leave it that way and import the rest.
    await page.click('button:has-text("Import")');
    await page.waitForSelector('text=/Import$/', { timeout: 10_000 });
    await page.click('div[role="dialog"] button:has-text("Import")');
    await page.waitForSelector('text=/applicants? imported/i', { timeout: 60_000 });

    const applications = await db.application.findMany({
      where: { organisationId: orgId },
      select: { externalApplicant: { select: { fullName: true } } },
    });
    check('two applicants were created', applications.length === 2, String(applications.length));
    const names = applications.map((a) => a.externalApplicant?.fullName ?? '').join(' | ');
    check('the chosen applicant is among them', names.includes(`Dlamini${tag}`));
    check(
      'the duplicate was not imported',
      applications.filter((a) => (a.externalApplicant?.fullName ?? '').includes(`Khumalo${tag}`))
        .length === 1,
      names,
    );

    console.log('\nNothing is deleted by a decision');
    const kept = await db.applicationImportFile.count({ where: { batchId } });
    check('every uploaded file is still recorded', kept === 4, String(kept));
    const discarded = await db.applicationImportFile.count({
      where: { batchId, status: 'DISCARDED' },
    });
    check('the one left out is marked discarded, not removed', discarded === 1);

    console.log('\nThe applicants reach the Applications list');
    await page.goto(`${BASE}/corporate/applications`, { waitUntil: 'networkidle' });
    const appsBody = (await page.textContent('body')) ?? '';
    check('the imported applicant is listed', appsBody.includes(`Dlamini${tag}`));

    console.log('\nOne organisation cannot read another\'s import');
    const otherTag = randomBytes(3).toString('hex');
    const other = await db.organisation.create({
      data: {
        name: `Rival Trust ${otherTag}`,
        type: 'CORPORATION',
        industry: 'OTHER',
        origin: 'REGISTERED',
      },
      select: { id: true },
    });
    await db.user.create({
      data: {
        email: `rival.${otherTag}@example.test`,
        passwordHash: await hash(password, 10),
        firstName: 'Rival',
        lastName: 'User',
        role: 'CORPORATE',
        emailVerifiedAt: new Date(),
        corporateProfile: { create: { organisationId: other.id, onboardingCompletedAt: new Date() } },
      },
    });
    const rival = await browser.newPage();
    await login(rival, `rival.${otherTag}@example.test`, password);
    const denied = await rival.request.get(`${BASE}/api/corporate/imports/${batchId}/export`);
    check('the rival organisation is refused', denied.status() === 404, String(denied.status()));
    await rival.close();

    await db.organisation.delete({ where: { id: other.id } });
  } finally {
    if (browser) await browser.close();
    if (orgId) {
      await db.applicationImportBatch.deleteMany({ where: { organisationId: orgId } });
      await db.application.deleteMany({ where: { organisationId: orgId } });
      await db.externalApplicant.deleteMany({ where: { organisationId: orgId } });
      await db.fundingProgramme.deleteMany({ where: { organisationId: orgId } });
      await db.user.deleteMany({ where: { corporateProfile: { organisationId: orgId } } });
      await db.organisation.delete({ where: { id: orgId } }).catch(() => undefined);
    }
    await db.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const name of failures) console.log(`  - ${name}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
