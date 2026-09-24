/**
 * Every page, under a real session.
 *
 * The suites check behaviour: a journey works, a guard refuses, a number is
 * right. None of them opens every screen, so a page that throws the moment it
 * renders -- a field renamed in the schema, a relation the query forgot to
 * include -- survives a fully green run and is found by whoever opens it
 * first. This walks all 69 of them.
 *
 * A page counts as passing when it answers 200 and the HTML does not carry
 * Next.js's error boundary. A redirect is a failure here: every route below is
 * one the actor signing in is entitled to see, so being sent elsewhere means
 * a guard is wrong, not that the page is fine.
 *
 * Dynamic segments are filled from real rows. The actors are created here, but
 * the rows behind /admin/data-sources/[runId] and the auto-fill screens belong
 * to pipelines this script does not run; where none exists, the route is
 * reported as uncovered rather than quietly passed.
 *
 * Usage: npm run build && npm start, then `npm run smoke`.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const db = new PrismaClient();

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

function skip(route: string, why: string) {
  skipped += 1;
  console.log(`  SKIP  ${route} -- ${why}`);
}

/** A cookie jar, so each actor keeps its own session across requests. */
class Actor {
  private cookies = new Map<string, string>();

  /**
   * A distinct client address per actor.
   *
   * The login limiter buckets by address as well as by account, and this run
   * signs five different people in well inside the per-address allowance for
   * one. Real users do not share an address, so neither do the actors here;
   * the per-account limit, which is the one that stops credential stuffing,
   * still applies untouched.
   */
  private readonly ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

  constructor(readonly label: string) {}

  private absorb(response: Response) {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  private header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async login(email: string, password: string) {
    const response = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': this.ip },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
    });
    this.absorb(response);
    check(`${this.label} can sign in`, response.status === 200, `status ${response.status}`);
  }

  async get(path: string) {
    const response = await fetch(`${BASE}${path}`, {
      headers: {
        'x-forwarded-for': this.ip,
        ...(this.cookies.size ? { Cookie: this.header() } : {}),
      },
      redirect: 'manual',
    });
    const body = response.status === 200 ? await response.text() : '';
    return { status: response.status, location: response.headers.get('location'), body };
  }
}

/**
 * Next.js serves its error boundary with a 200, so the status alone does not
 * say the page rendered. These are the strings that boundary puts in the HTML.
 */
const ERROR_MARKERS = [
  'Application error: a client-side exception',
  'Application error: a server-side exception',
  'This page could not be found',
  'Internal Server Error',
];

/**
 * @param sendsTo where the route is supposed to redirect, when it is supposed
 *   to. Three of these routes are not pages in their own right -- `/admin` is
 *   an index, `/verify` needs a token from an email, and the apply screen sends
 *   a student who has already applied to the application they made. Asserting
 *   the destination checks that behaviour instead of excusing it.
 */
async function page(actor: Actor, route: string, sendsTo?: string) {
  const { status, location, body } = await actor.get(route);

  if (sendsTo) {
    check(
      `${route} sends the visitor to ${sendsTo}`,
      status === 307 && location === sendsTo,
      location ? `status ${status} -> ${location}` : `status ${status}`,
    );
    return;
  }

  if (status !== 200) {
    check(route, false, location ? `status ${status} -> ${location}` : `status ${status}`);
    return;
  }
  const marker = ERROR_MARKERS.find((m) => body.includes(m));
  check(route, !marker, marker);
}

async function main() {
  const tag = randomBytes(4).toString('hex');
  const password = 'Smoke-Password-1';
  const created: string[] = [];
  let orgId = '';

  try {
    // --- anonymous ---------------------------------------------------------
    console.log('\nPages anybody can open');
    const anon = new Actor('a visitor');
    for (const route of [
      '/',
      '/login',
      '/register',
      '/register/student',
      '/register/organisation',
      '/forgot-password',
      '/help',
      '/legal/privacy',
      '/legal/terms',
    ]) {
      await page(anon, route);
    }

    // Both are reached from an emailed link. Without a token `/reset-password`
    // renders its own "this link is not valid" state, while `/verify` has
    // nothing to show anybody who is not signed in and sends them to sign in.
    await page(anon, '/reset-password');
    await page(anon, '/verify', '/login');

    console.log('\nThe health check');
    const health = await fetch(`${BASE}/api/health`, { headers: { 'cache-control': 'no-cache' } });
    const healthBody = (await health.json()) as { ok?: boolean; database?: string };
    check('it answers 200 while the database is up', health.status === 200, `status ${health.status}`);
    check('it reports the database as reachable', healthBody.ok === true && healthBody.database === 'ok');
    check(
      'it is never cached, so a load balancer sees the current state',
      health.headers.get('cache-control') === 'no-store',
      String(health.headers.get('cache-control')),
    );

    // --- the funder --------------------------------------------------------
    console.log('\nPages a funder opens');
    const organisation = await db.organisation.create({
      data: {
        name: `Smoke Test Trust ${tag}`,
        type: 'CORPORATION',
        industry: 'OTHER',
        origin: 'REGISTERED',
      },
      select: { id: true },
    });
    orgId = organisation.id;

    const corporateEmail = `smoke.corporate.${tag}@example.test`;
    await db.user.create({
      data: {
        email: corporateEmail,
        passwordHash: await hash(password, 4),
        firstName: 'Thandi',
        lastName: 'Funder',
        role: 'CORPORATE',
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        corporateProfile: { create: { organisationId: orgId, onboardingCompletedAt: new Date() } },
      },
      select: { id: true },
    });

    const programme = await db.fundingProgramme.create({
      data: {
        organisationId: orgId,
        name: `Smoke Test Bursary ${tag}`,
        slug: `smoke-test-${tag}`,
        shortDescription: 'A programme used to open every funder screen.',
        fullDescription: 'A programme used to open every funder screen.',
        fundingType: 'BURSARY',
        coverage: ['TUITION_FEES'],
        status: 'PUBLISHED',
        origin: 'FIRST_PARTY',
        availability: 'OPEN',
        openDate: new Date(Date.now() - 7 * 86_400_000),
        closingDate: new Date(Date.now() + 60 * 86_400_000),
        officialSource: true,
        sourceName: 'Bursary-Bridge (published by the funder)',
        sourceType: 'OFFICIAL_ORGANISATION',
        verificationStatus: 'VERIFIED',
        lastVerifiedAt: new Date(),
        lastCheckedAt: new Date(),
        eligibility: { create: { requiresFinancialNeed: false } },
      },
      select: { id: true, slug: true },
    });

    const batch = await db.applicationImportBatch.create({
      data: {
        organisationId: orgId,
        fundingProgrammeId: programme.id,
        reference: 'Smoke batch',
        status: 'READY_FOR_REVIEW',
      },
      select: { id: true },
    });

    const corporate = new Actor('a funder');
    await corporate.login(corporateEmail, password);
    for (const route of [
      '/corporate/dashboard',
      '/corporate/programmes',
      '/corporate/programmes/new',
      `/corporate/programmes/${programme.id}`,
      `/corporate/programmes/${programme.id}/edit`,
      '/corporate/applications',
      '/corporate/beneficiaries',
      '/corporate/shortlists',
      '/corporate/imports',
      '/corporate/imports/new',
      `/corporate/imports/${batch.id}`,
      '/corporate/notifications',
      '/corporate/organisation',
      '/corporate/reports',
      '/corporate/settings',
    ]) {
      await page(corporate, route);
    }

    // --- the student -------------------------------------------------------
    console.log('\nPages a student opens');
    const studentEmail = `smoke.student.${tag}@example.test`;
    const student = await db.user.create({
      data: {
        email: studentEmail,
        passwordHash: await hash(password, 4),
        firstName: 'Nomsa',
        lastName: 'Learner',
        role: 'STUDENT',
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        studentProfile: {
          create: {
            onboardingCompletedAt: new Date(),
            onboardingStep: 'review',
            educationStage: 'UNIVERSITY_CURRENT',
            qualificationLevel: 'BACHELORS',
            yearOfStudy: 2,
            academicAverage: 74,
            province: 'GAUTENG',
            citizenship: 'SA_CITIZEN',
            householdIncome: 'BELOW_50K',
          },
        },
      },
      select: { id: true, studentProfile: { select: { id: true } } },
    });
    const studentProfileId = student.studentProfile!.id;

    const application = await db.application.create({
      data: {
        studentProfileId,
        organisationId: orgId,
        fundingProgrammeId: programme.id,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    const letter = await db.motivationalLetter.create({
      data: {
        studentProfileId,
        fundingProgrammeId: programme.id,
        opportunityName: `Smoke Test Bursary ${tag}`,
        organisationName: `Smoke Test Trust ${tag}`,
        title: `Smoke Test Letter ${tag}`,
        content: 'A letter used to open the letter screen.',
      },
      select: { id: true },
    });

    // A student who has already applied is sent to the application they made,
    // so the apply screen itself is opened on a programme they have not.
    const unapplied = await db.fundingProgramme.create({
      data: {
        organisationId: orgId,
        name: `Smoke Test Bursary (unapplied) ${tag}`,
        slug: `smoke-test-unapplied-${tag}`,
        shortDescription: 'A programme used to open the apply screen.',
        fullDescription: 'A programme used to open the apply screen.',
        fundingType: 'BURSARY',
        coverage: ['TUITION_FEES'],
        status: 'PUBLISHED',
        origin: 'FIRST_PARTY',
        availability: 'OPEN',
        openDate: new Date(Date.now() - 7 * 86_400_000),
        closingDate: new Date(Date.now() + 60 * 86_400_000),
        officialSource: true,
        sourceName: 'Bursary-Bridge (published by the funder)',
        sourceType: 'OFFICIAL_ORGANISATION',
        verificationStatus: 'VERIFIED',
        lastVerifiedAt: new Date(),
        lastCheckedAt: new Date(),
        eligibility: { create: { requiresFinancialNeed: false } },
      },
      select: { id: true },
    });

    const learner = new Actor('a student');
    await learner.login(studentEmail, password);
    for (const route of [
      '/student/dashboard',
      '/student/opportunities',
      `/student/opportunities/${programme.id}`,
      `/student/opportunities/${unapplied.id}/apply`,
      '/student/bursaries',
      `/student/bursaries/${programme.slug}`,
      '/student/applications',
      `/student/applications/${application.id}`,
      '/student/auto-fill',
      '/student/letters',
      '/student/letters/new',
      `/student/letters/${letter.id}`,
      '/student/documents',
      '/student/results',
      '/student/profile',
      '/student/notifications',
      '/student/settings',
    ]) {
      await page(learner, route);
    }

    await page(
      learner,
      `/student/opportunities/${programme.id}/apply`,
      `/student/applications/${application.id}`,
    );

    // Both screens read the job from the database and link to the stored PDF
    // rather than opening it, so rows are enough to render them. Whether the
    // filling itself is right is the auto-fill suite's question, not this one's.
    const job = await db.autoFillJob.create({
      data: {
        studentProfileId,
        status: 'COMPLETED',
        sourceFileName: 'completed-application.pdf',
        sourceStorageKey: `smoke/${tag}/source.pdf`,
        sourceSizeBytes: 24_576,
        sourcePageCount: 3,
        matcher: 'label-similarity',
        completedAt: new Date(),
        targetForms: {
          create: [
            {
              status: 'COMPLETED',
              originalFileName: 'bursary-form.pdf',
              originalStorageKey: `smoke/${tag}/target.pdf`,
              sizeBytes: 18_432,
              pageCount: 2,
              fieldsTotal: 12,
              fieldsFilled: 9,
              fieldsToConfirm: 2,
              fieldsOutstanding: 3,
              processedAt: new Date(),
              fields: {
                create: [
                  {
                    fieldName: 'First Name',
                    label: 'First Name',
                    kind: 'text',
                    page: 1,
                    reason: 'Matched the profile field of the same name.',
                    status: 'FILLED',
                    value: 'Nomsa',
                    confidence: 'HIGH',
                  },
                  {
                    fieldName: 'Household Income',
                    label: 'Household Income',
                    kind: 'text',
                    page: 1,
                    reason: 'The wording on the form differs from the profile field.',
                    status: 'NEEDS_REVIEW',
                    value: 'Below R50 000',
                    confidence: 'LOW',
                  },
                  {
                    fieldName: 'Student Number',
                    label: 'Student Number',
                    kind: 'text',
                    page: 2,
                    reason: 'Nothing in the profile answers this.',
                    status: 'MISSING',
                  },
                ],
              },
            },
          ],
        },
      },
      select: { id: true, targetForms: { select: { id: true } } },
    });
    await page(learner, `/student/auto-fill/${job.id}`);
    await page(learner, `/student/auto-fill/${job.id}/forms/${job.targetForms[0].id}`);

    // --- the administrator -------------------------------------------------
    console.log('\nPages an administrator opens');
    const adminEmail = `smoke.admin.${tag}@example.test`;
    const adminUser = await db.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hash(password, 4),
        firstName: 'Sipho',
        lastName: 'Administrator',
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
      },
      select: { id: true },
    });
    created.push(adminUser.id, student.id);

    const admin = new Actor('an administrator');
    await admin.login(adminEmail, password);
    await page(admin, '/admin', '/admin/dashboard');
    for (const route of [
      '/admin/dashboard',
      '/admin/users',
      `/admin/users/${student.id}`,
      '/admin/organisations',
      `/admin/organisations/${orgId}`,
      '/admin/programmes',
      '/admin/catalogue',
      '/admin/data-sources',
      '/admin/audit',
    ]) {
      await page(admin, route);
    }

    const run = await db.ingestionRun.findFirst({
      select: { id: true },
      orderBy: { startedAt: 'desc' },
    });
    if (run) {
      await page(admin, `/admin/data-sources/${run.id}`);
    } else {
      skip('/admin/data-sources/[runId]', 'no ingestion run recorded');
    }

    // --- onboarding --------------------------------------------------------
    // Both wizards redirect once their profile is complete, so they are walked
    // by actors who have not finished them.
    console.log('\nThe onboarding wizards, by someone still in them');
    const freshStudentEmail = `smoke.fresh.student.${tag}@example.test`;
    await db.user.create({
      data: {
        email: freshStudentEmail,
        passwordHash: await hash(password, 4),
        firstName: 'Lerato',
        lastName: 'Newcomer',
        role: 'STUDENT',
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        studentProfile: { create: { onboardingStep: 'education' } },
      },
    });
    const fresh = new Actor('a new student');
    await fresh.login(freshStudentEmail, password);
    for (const route of [
      '/onboarding/student/education',
      '/onboarding/student/academic',
      '/onboarding/student/location',
      '/onboarding/student/financial',
      '/onboarding/student/funding',
      '/onboarding/student/preferences',
      '/onboarding/student/review',
    ]) {
      await page(fresh, route);
    }

    const freshOrg = await db.organisation.create({
      data: {
        name: `Smoke Onboarding Trust ${tag}`,
        type: 'CORPORATION',
        industry: 'OTHER',
        origin: 'REGISTERED',
      },
      select: { id: true },
    });
    const freshCorporateEmail = `smoke.fresh.corporate.${tag}@example.test`;
    await db.user.create({
      data: {
        email: freshCorporateEmail,
        passwordHash: await hash(password, 4),
        firstName: 'Kabelo',
        lastName: 'Newfunder',
        role: 'CORPORATE',
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        corporateProfile: { create: { organisationId: freshOrg.id, onboardingStep: 'role' } },
      },
    });
    const freshCorporate = new Actor('a new funder');
    await freshCorporate.login(freshCorporateEmail, password);
    for (const route of [
      '/onboarding/organisation/role',
      '/onboarding/organisation/details',
      '/onboarding/organisation/funding',
      '/onboarding/organisation/process',
      '/onboarding/organisation/review',
    ]) {
      await page(freshCorporate, route);
    }

    // --- cleanup -----------------------------------------------------------
    await db.autoFillJob.deleteMany({ where: { id: job.id } });
    await db.motivationalLetter.deleteMany({ where: { id: letter.id } });
    await db.application.deleteMany({ where: { id: application.id } });
    await db.applicationImportBatch.deleteMany({ where: { id: batch.id } });
    await db.user.deleteMany({ where: { email: { contains: `.${tag}@example.test` } } });
    await db.organisation.deleteMany({ where: { id: { in: [orgId, freshOrg.id] } } });
  } finally {
    await db.$disconnect();
  }

  console.log(
    `\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} not covered` : ''}\n`,
  );
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
