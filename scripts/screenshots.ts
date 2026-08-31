/**
 * Visual QA capture.
 *
 * Signs in as each demo account and screenshots every major screen at desktop,
 * tablet and mobile widths, so the implementation can be compared against the
 * approved reference designs.
 *
 * Usage: npm run dev, then `npm run screenshots`.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.SCREENSHOT_DIR ?? path.resolve(process.cwd(), '.screenshots');
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 834, height: 1100 },
  { name: 'mobile', width: 390, height: 900 },
] as const;

type Shot = { name: string; path: string; full?: boolean };

const PUBLIC_SHOTS: Shot[] = [
  { name: 'landing', path: '/', full: true },
  { name: 'login', path: '/login' },
  { name: 'register-chooser', path: '/register' },
  { name: 'register-student', path: '/register/student' },
  { name: 'register-organisation', path: '/register/organisation' },
];

const STUDENT_SHOTS: Shot[] = [
  { name: 'student-dashboard', path: '/student/dashboard', full: true },
  { name: 'student-opportunities', path: '/student/opportunities', full: true },
  { name: 'student-applications', path: '/student/applications', full: true },
  { name: 'student-profile', path: '/student/profile', full: true },
  { name: 'student-documents', path: '/student/documents' },
  { name: 'student-notifications', path: '/student/notifications' },
  { name: 'student-settings', path: '/student/settings' },
];

const CORPORATE_SHOTS: Shot[] = [
  { name: 'corporate-dashboard', path: '/corporate/dashboard', full: true },
  { name: 'corporate-programmes', path: '/corporate/programmes' },
  { name: 'corporate-programme-new', path: '/corporate/programmes/new', full: true },
  { name: 'corporate-applications', path: '/corporate/applications', full: true },
  { name: 'corporate-shortlists', path: '/corporate/shortlists' },
  { name: 'corporate-beneficiaries', path: '/corporate/beneficiaries' },
  { name: 'corporate-reports', path: '/corporate/reports', full: true },
  { name: 'corporate-organisation', path: '/corporate/organisation', full: true },
];

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(student|corporate)\//, { timeout: 20_000 });
}

async function capture(browser: Browser, shots: Shot[], viewport: (typeof VIEWPORTS)[number], email?: string) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  if (email) await login(page, email);

  for (const shot of shots) {
    try {
      await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle', timeout: 30_000 });
      // Let fonts settle so text metrics are stable between runs.
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT, viewport.name, `${shot.name}.png`),
        fullPage: shot.full ?? false,
      });
      console.log(`  ${viewport.name}/${shot.name}.png`);
    } catch (error) {
      console.log(`  ${viewport.name}/${shot.name} FAILED — ${(error as Error).message.split('\n')[0]}`);
    }
  }

  await context.close();
}

/** Follows the first opportunity link so detail screens are captured too. */
async function captureDynamic(browser: Browser, viewport: (typeof VIEWPORTS)[number]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();

  await login(page, 'student@demo.bursarybridge.local');
  await page.goto(`${BASE}/student/opportunities`, { waitUntil: 'networkidle' });

  const opportunity = await page.locator('a[href^="/student/opportunities/"]').first().getAttribute('href');
  if (opportunity) {
    await page.goto(`${BASE}${opportunity}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, viewport.name, 'student-opportunity-detail.png'),
      fullPage: true,
    });
    console.log(`  ${viewport.name}/student-opportunity-detail.png`);

    await page.goto(`${BASE}${opportunity}/apply`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, viewport.name, 'student-apply.png'),
      fullPage: true,
    });
    console.log(`  ${viewport.name}/student-apply.png`);
  }

  await page.goto(`${BASE}/student/applications`, { waitUntil: 'networkidle' });
  const application = await page.locator('a[href^="/student/applications/"]').first().getAttribute('href');
  if (application) {
    await page.goto(`${BASE}${application}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, viewport.name, 'student-application-detail.png'),
      fullPage: true,
    });
    console.log(`  ${viewport.name}/student-application-detail.png`);
  }

  await context.close();

  // Corporate applicant profile and programme detail.
  const corpContext = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const corpPage = await corpContext.newPage();
  await login(corpPage, 'corporate@demo.bursarybridge.local');

  await corpPage.goto(`${BASE}/corporate/applications`, { waitUntil: 'networkidle' });
  const applicant = await corpPage
    .locator('a[href^="/corporate/applications/"]')
    .first()
    .getAttribute('href');
  if (applicant) {
    await corpPage.goto(`${BASE}${applicant}`, { waitUntil: 'networkidle' });
    await corpPage.waitForTimeout(300);
    await corpPage.screenshot({
      path: path.join(OUT, viewport.name, 'corporate-applicant-profile.png'),
      fullPage: true,
    });
    console.log(`  ${viewport.name}/corporate-applicant-profile.png`);
  }

  await corpPage.goto(`${BASE}/corporate/programmes`, { waitUntil: 'networkidle' });
  const programme = await corpPage
    .locator('a[href^="/corporate/programmes/"]')
    .first()
    .getAttribute('href');
  if (programme && !programme.endsWith('/new')) {
    await corpPage.goto(`${BASE}${programme}`, { waitUntil: 'networkidle' });
    await corpPage.waitForTimeout(300);
    await corpPage.screenshot({
      path: path.join(OUT, viewport.name, 'corporate-programme-detail.png'),
      fullPage: true,
    });
    console.log(`  ${viewport.name}/corporate-programme-detail.png`);
  }

  await corpContext.close();
}

async function main() {
  console.log(`Capturing screens from ${BASE} into ${OUT}\n`);

  for (const viewport of VIEWPORTS) {
    await mkdir(path.join(OUT, viewport.name), { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  });

  try {
    for (const viewport of VIEWPORTS) {
      console.log(`\n${viewport.name} (${viewport.width}x${viewport.height})`);
      await capture(browser, PUBLIC_SHOTS, viewport);
      await capture(browser, STUDENT_SHOTS, viewport, 'student@demo.bursarybridge.local');
      await capture(browser, CORPORATE_SHOTS, viewport, 'corporate@demo.bursarybridge.local');
      await captureDynamic(browser, viewport);
    }
  } finally {
    await browser.close();
  }

  console.log('\nCapture complete.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
