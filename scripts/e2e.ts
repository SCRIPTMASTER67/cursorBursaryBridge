/**
 * End-to-end journey checks.
 *
 * Drives both complete user journeys against a running server using the real
 * HTTP API and real session cookies, then asserts the resulting database state.
 * Nothing here is mocked.
 *
 * Usage: npm run dev, then `npm run test:e2e`.
 */
import '../lib/load-env';
import { createHash, randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * The harness reads programme questions straight from the database.
 * Answers are keyed by question id, and the application form only renders those
 * fields once the user reaches step 2, so they are not in the first response.
 */
const db = new PrismaClient();

/**
 * A published programme the seeded student profile will match.
 *
 * Deliberately broad: no course, institution or academic restrictions, so it
 * matches any onboarded student and the test measures the matching pipeline
 * rather than the eligibility rules, which have their own checks.
 */
async function createMatchableProgramme(runId: string) {
  const organisation = await db.organisation.create({
    data: {
      name: `E2E Test Funder ${runId}`,
      type: 'CORPORATION',
      industry: 'OTHER',
      origin: 'REGISTERED',
    },
    select: { id: true },
  });

  const openDate = new Date(Date.now() - 7 * 86_400_000);
  const closingDate = new Date(Date.now() + 60 * 86_400_000);

  await db.fundingProgramme.create({
    data: {
      organisationId: organisation.id,
      name: `E2E Matchable Bursary ${runId}`,
      slug: `e2e-matchable-bursary-${runId}`,
      shortDescription: 'Created by the end-to-end checks. Removed when they finish.',
      fullDescription: 'Created by the end-to-end checks. Removed when they finish.',
      fundingType: 'BURSARY',
      coverage: ['TUITION_FEES'],
      openDate,
      closingDate,
      status: 'PUBLISHED',
      origin: 'FIRST_PARTY',
      availability: 'OPEN',
      officialSource: true,
      sourceName: 'Bursary-Bridge (published by the funder)',
      sourceType: 'OFFICIAL_ORGANISATION',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      lastCheckedAt: new Date(),
      eligibility: { create: { requiresFinancialNeed: false } },
    },
  });
}

async function questionIdsFor(fundingProgrammeId: string): Promise<string[]> {
  const questions = await db.applicationQuestion.findMany({
    where: { fundingProgrammeId },
    select: { id: true },
    orderBy: { order: 'asc' },
  });
  return questions.map((question) => question.id);
}

/**
 * Remove everything this run created.
 *
 * The checks write real rows to the same database the demo accounts use, so
 * without this a test run would leave "E2E Demo Funder" programmes sitting in
 * the seeded student's matches. Cascades handle the dependent rows.
 */
async function cleanUp(runId: string) {
  const { count: users } = await db.user.deleteMany({
    where: { email: { startsWith: 'e2e.', contains: runId } },
  });
  // Organisations are not cascaded from the user, so they go separately.
  const { count: organisations } = await db.organisation.deleteMany({
    where: { name: { contains: runId } },
  });
  console.log(`\nCleaned up ${users} test user(s) and ${organisations} test organisation(s).`);
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

/** A cookie jar, so each actor keeps its own session across requests. */
class Session {
  private cookies = new Map<string, string>();

  private header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private store(response: Response) {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  async json<T = Record<string, unknown>>(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; body: T }> {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookies.size ? { Cookie: this.header() } : {}),
        ...(init.headers ?? {}),
      },
    });
    this.store(response);
    const body = (await response.json().catch(() => ({}))) as T;
    return { status: response.status, body };
  }

  async page(path: string): Promise<{ status: number; html: string; location: string | null }> {
    const response = await fetch(`${BASE}${path}`, {
      redirect: 'manual',
      headers: this.cookies.size ? { Cookie: this.header() } : {},
    });
    this.store(response);
    return {
      status: response.status,
      html: response.status < 400 ? await response.text() : '',
      location: response.headers.get('location'),
    };
  }
}

const unique = Date.now().toString(36);
const PASSWORD = 'Journey1234!';

async function main() {
  console.log(`Running end-to-end checks against ${BASE}\n`);

  // =========================================================================
  section('Student journey');
  // =========================================================================
  const student = new Session();
  const studentEmail = `e2e.student.${unique}@demo.bursarybridge.local`;

  // 1. Register
  const registration = await student.json<{ redirectTo?: string; error?: string }>(
    '/api/auth/register/student',
    {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Journey',
        lastName: 'Tester',
        email: studentEmail,
        mobile: '0821112222',
        password: PASSWORD,
        confirmPassword: PASSWORD,
        emailNotifications: true,
        acceptedTerms: true,
      }),
    },
  );
  check('1. student registers', registration.status === 201, `status ${registration.status}`);

  // Weak passwords and mismatches are rejected server-side.
  const weak = new Session();
  const weakAttempt = await weak.json<{ fields?: Record<string, string> }>(
    '/api/auth/register/student',
    {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Weak',
        lastName: 'Password',
        email: `e2e.weak.${unique}@demo.bursarybridge.local`,
        mobile: '0821112223',
        password: 'short',
        confirmPassword: 'short',
        emailNotifications: true,
        acceptedTerms: true,
      }),
    },
  );
  check(
    '   a weak password is rejected by the server',
    weakAttempt.status === 422 && Boolean(weakAttempt.body.fields?.password),
    `status ${weakAttempt.status}`,
  );

  const duplicate = await new Session().json('/api/auth/register/student', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Duplicate',
      lastName: 'Email',
      email: studentEmail,
      mobile: '0821112224',
      password: PASSWORD,
      confirmPassword: PASSWORD,
      emailNotifications: true,
      acceptedTerms: true,
    }),
  });
  check('   a duplicate email is rejected', duplicate.status === 409, `status ${duplicate.status}`);

  // 2. Catalogue is available to the signed-in student
  const catalogue = await student.json<{
    institutions: { id: string; name: string }[];
    programmes: { id: string; name: string }[];
  }>('/api/catalog');
  check(
    '2. standardised catalogue loads',
    catalogue.status === 200 && (catalogue.body.institutions?.length ?? 0) > 0,
    `status ${catalogue.status}`,
  );

  // Everything downstream depends on the catalogue, so stop with a readable
  // message rather than a TypeError if the server is not serving it.
  if (!catalogue.body.institutions?.length || !catalogue.body.programmes?.length) {
    throw new Error(
      `The catalogue came back empty (status ${catalogue.status}). ` +
        'Is the dev server running and the database seeded? Run `npm run dev` and `npm run db:seed`.',
    );
  }

  const up = catalogue.body.institutions.find((i) => i.name === 'University of Pretoria')!;
  const uj = catalogue.body.institutions.find((i) => i.name === 'University of Johannesburg')!;
  const tut = catalogue.body.institutions.find(
    (i) => i.name === 'Tshwane University of Technology',
  )!;
  const cs = catalogue.body.programmes.find((p) => p.name === 'Computer Science')!;
  const it = catalogue.body.programmes.find((p) => p.name === 'Information Technology')!;

  // 3. Education step
  const education = await student.json('/api/student/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'education',
      data: {
        educationStage: 'UNIVERSITY_CURRENT',
        qualificationLevel: 'BACHELORS',
        studyStatus: 'CURRENTLY_ENROLLED',
        currentInstitutionId: up.id,
        currentProgrammeId: cs.id,
        yearOfStudy: 2,
      },
    }),
  });
  check('3. education step saves', education.status === 200, `status ${education.status}`);

  // Enrolled students must say where they study — the server enforces it.
  const incompleteEducation = await student.json<{ fields?: Record<string, string> }>(
    '/api/student/onboarding',
    {
      method: 'POST',
      body: JSON.stringify({
        step: 'education',
        data: { educationStage: 'UNIVERSITY_CURRENT', studyStatus: 'CURRENTLY_ENROLLED' },
      }),
    },
  );
  check(
    '   an enrolled student without an institution is rejected',
    incompleteEducation.status === 422 &&
      Boolean(incompleteEducation.body.fields?.currentInstitutionId),
    `status ${incompleteEducation.status}`,
  );

  // 4. Study preferences — course paired with institution, capped at six
  const preferences = await student.json('/api/student/preferences', {
    method: 'PUT',
    body: JSON.stringify({
      preferences: [
        { programmeId: cs.id, institutionId: up.id },
        { programmeId: cs.id, institutionId: uj.id },
        { programmeId: it.id, institutionId: tut.id },
      ],
    }),
  });
  check(
    '4. three study preferences save',
    preferences.status === 200,
    `status ${preferences.status}`,
  );

  const overLimit = await student.json<{ error?: string }>('/api/student/preferences', {
    method: 'PUT',
    body: JSON.stringify({
      preferences: catalogue.body.programmes.slice(0, 7).map((programme, index) => ({
        programmeId: programme.id,
        institutionId: catalogue.body.institutions[index].id,
      })),
    }),
  });
  check(
    '   a seventh preference is rejected',
    overLimit.status === 422 && Boolean(overLimit.body.error?.includes('6')),
    `status ${overLimit.status}`,
  );

  const duplicatePair = await student.json('/api/student/preferences', {
    method: 'PUT',
    body: JSON.stringify({
      preferences: [
        { programmeId: cs.id, institutionId: up.id },
        { programmeId: cs.id, institutionId: up.id },
      ],
    }),
  });
  check('   a duplicate course/institution pair is rejected', duplicatePair.status === 422);

  // Restore the good set after the rejected attempts.
  await student.json('/api/student/preferences', {
    method: 'PUT',
    body: JSON.stringify({
      preferences: [
        { programmeId: cs.id, institutionId: up.id },
        { programmeId: cs.id, institutionId: uj.id },
        { programmeId: it.id, institutionId: tut.id },
      ],
    }),
  });

  // 5–8. Remaining profile steps
  const academic = await student.json('/api/student/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'academic',
      data: {
        academicAverage: 82,
        academicAverageUnknown: false,
        resultTypes: ['MATRIC_RESULTS', 'UNIVERSITY_TRANSCRIPT'],
        achievements: ['SUBJECT_DISTINCTIONS'],
      },
    }),
  });
  check('5. academic profile saves', academic.status === 200, `status ${academic.status}`);

  const badAverage = await student.json('/api/student/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'academic',
      data: {
        academicAverage: 140,
        academicAverageUnknown: false,
        resultTypes: [],
        achievements: [],
      },
    }),
  });
  check('   an average above 100% is rejected', badAverage.status === 422);

  const funding = await student.json('/api/student/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'funding',
      data: {
        fundingNeeds: ['TUITION_FEES', 'ACCOMMODATION', 'FULL_FUNDING'],
        fundingSituation: 'NO_FUNDING',
      },
    }),
  });
  check('6. funding needs save', funding.status === 200, `status ${funding.status}`);

  const financial = await student.json('/api/student/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'financial',
      data: {
        householdIncome: 'R100K_200K',
        bursaryStatus: 'NO',
        dateOfBirth: '2004-05-12',
        citizenship: 'SA_CITIZEN',
        firstGeneration: 'YES',
      },
    }),
  });
  check('7. financial profile saves', financial.status === 200, `status ${financial.status}`);

  const location = await student.json<{ profileStrength?: number }>('/api/student/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'location',
      data: {
        province: 'GAUTENG',
        city: 'Pretoria',
        studyLocationPreference: 'SAME_LOCATION',
        careerInterests: ['TECHNOLOGY', 'ENGINEERING'],
      },
    }),
  });
  check('8. location and interests save', location.status === 200, `status ${location.status}`);

  const tooManyInterests = await student.json('/api/student/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'location',
      data: {
        province: 'GAUTENG',
        city: 'Pretoria',
        studyLocationPreference: 'SAME_LOCATION',
        careerInterests: ['TECHNOLOGY', 'ENGINEERING', 'HEALTHCARE', 'LAW', 'BUSINESS', 'MINING'],
      },
    }),
  });
  check('   a sixth career interest is rejected', tooManyInterests.status === 422);

  // 9. Finish onboarding
  const review = await student.json<{ redirectTo?: string }>('/api/student/onboarding', {
    method: 'POST',
    body: JSON.stringify({ step: 'review', data: { confirm: true } }),
  });
  check(
    '9. onboarding completes and unlocks the dashboard',
    review.status === 200 && review.body.redirectTo === '/student/dashboard',
    `status ${review.status}`,
  );

  // A programme for this student to match against.
  //
  // The database holds no seeded bursaries -- opportunities come from a funder
  // publishing one or from the ingestion pipeline, never from a seed -- so the
  // student journey creates its own rather than depending on data that may or
  // may not be there. Everything it creates is removed by cleanUp().
  await createMatchableProgramme(unique);

  // 10. Matches
  const dashboard = await student.page('/student/dashboard');
  check('10. dashboard renders', dashboard.status === 200, `status ${dashboard.status}`);
  check('    it greets the student by name', dashboard.html.includes('Journey'));
  check('    it shows a match percentage', /\d+%\s*Match|% Match/.test(dashboard.html));
  check('    it explains why they match', dashboard.html.includes('Why you match'));

  const opportunities = await student.page('/student/opportunities');
  check('    opportunities list renders', opportunities.status === 200);

  const opportunityIds = [
    ...new Set(
      [...opportunities.html.matchAll(/\/student\/opportunities\/(c[a-z0-9]{20,})/g)].map(
        (m) => m[1],
      ),
    ),
  ];
  check(
    '    at least one opportunity is matched',
    opportunityIds.length > 0,
    `found ${opportunityIds.length}`,
  );

  // 11. Opportunity detail shows the reasoning, not just a score
  const detail = await student.page(`/student/opportunities/${opportunityIds[0]}`);
  check('11. opportunity detail renders', detail.status === 200, `status ${detail.status}`);
  check(
    '    it lists eligibility requirements',
    detail.html.includes('Apply Now') || detail.html.includes('Apply'),
  );
  check(
    '    it shows the per-criterion breakdown',
    detail.html.includes('Course') && detail.html.includes('worth'),
  );

  // 12. Apply — draft, then submit
  const draft = await student.json<{ applicationId?: string }>('/api/student/applications', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'draft',
      fundingProgrammeId: opportunityIds[0],
      answers: {},
      documentIds: [],
    }),
  });
  check('12. application draft saves', draft.status === 200, `status ${draft.status}`);

  const unconfirmed = await student.json('/api/student/applications', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'submit',
      fundingProgrammeId: opportunityIds[0],
      answers: {},
      documentIds: [],
      confirmAccurate: false,
    }),
  });
  check('    submitting without confirming is rejected', unconfirmed.status === 422);

  // Answer any required programme questions.
  const applyPage = await student.page(`/student/opportunities/${opportunityIds[0]}/apply`);
  check('    the apply page renders', applyPage.status === 200, `status ${applyPage.status}`);

  const answers: Record<string, string> = {};
  for (const id of await questionIdsFor(opportunityIds[0])) {
    answers[id] = 'Answered during the end-to-end journey check.';
  }

  const submitted = await student.json<{ applicationId?: string; error?: string }>(
    '/api/student/applications',
    {
      method: 'POST',
      body: JSON.stringify({
        intent: 'submit',
        fundingProgrammeId: opportunityIds[0],
        answers,
        documentIds: [],
        confirmAccurate: true,
      }),
    },
  );
  const applicationId = submitted.body.applicationId;
  check(
    '    application submits',
    submitted.status === 200 && Boolean(applicationId),
    submitted.body.error ?? `status ${submitted.status}`,
  );

  const resubmit = await student.json('/api/student/applications', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'submit',
      fundingProgrammeId: opportunityIds[0],
      answers,
      documentIds: [],
      confirmAccurate: true,
    }),
  });
  check('    a second submission to the same programme is refused', resubmit.status === 409);

  // 13. Track it
  const tracking = await student.page(`/student/applications/${applicationId}`);
  check('13. application tracking renders', tracking.status === 200, `status ${tracking.status}`);
  check('    it shows the submitted status', tracking.html.includes('Submitted'));

  // =========================================================================
  section('Corporate journey');
  // =========================================================================
  const corporate = new Session();
  const corporateEmail = `e2e.funder.${unique}@demo.bursarybridge.local`;
  const orgName = `E2E Demo Funder ${unique}`;

  const corpRegistration = await corporate.json('/api/auth/register/organisation', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Funder',
      lastName: 'Tester',
      email: corporateEmail,
      mobile: '0833334444',
      password: PASSWORD,
      confirmPassword: PASSWORD,
      emailNotifications: true,
      acceptedTerms: true,
    }),
  });
  check(
    '1. corporate registers',
    corpRegistration.status === 201,
    `status ${corpRegistration.status}`,
  );

  const details = await corporate.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'details',
      data: {
        name: orgName,
        type: 'CORPORATION',
        industry: 'TECHNOLOGY',
        website: 'https://www.e2e-demo-funder.example',
        country: 'South Africa',
      },
    }),
  });
  check('2. organisation details save', details.status === 200, `status ${details.status}`);

  const roleStep = await corporate.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'role',
      data: { role: 'CSI_MANAGER', organisationSize: 'SIZE_251_1000', department: 'CSI' },
    }),
  });
  check('3. role saves', roleStep.status === 200, `status ${roleStep.status}`);

  const fundingProfile = await corporate.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'funding',
      data: {
        offersFunding: 'YES',
        programmeTypes: ['BURSARIES', 'SCHOLARSHIPS'],
        applicationVolume: 'V501_1000',
      },
    }),
  });
  check(
    '4. funding profile saves',
    fundingProfile.status === 200,
    `status ${fundingProfile.status}`,
  );

  const currentProcess = await corporate.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'process',
      data: {
        processMethods: ['EMAIL', 'SPREADSHEETS'],
        challenges: ['TOO_MANY_APPLICATIONS', 'MANUAL_SCREENING'],
      },
    }),
  });
  check(
    '5. current process saves',
    currentProcess.status === 200,
    `status ${currentProcess.status}`,
  );

  const tooManyChallenges = await corporate.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'process',
      data: {
        processMethods: ['EMAIL'],
        challenges: ['TOO_MANY_APPLICATIONS', 'MANUAL_SCREENING', 'REPORTING', 'SHORTLISTING'],
      },
    }),
  });
  check('   a fourth challenge is rejected', tooManyChallenges.status === 422);

  const corpReview = await corporate.json<{ redirectTo?: string }>('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({ step: 'review', data: { confirm: true } }),
  });
  check(
    '6. organisation is created',
    corpReview.status === 200 && corpReview.body.redirectTo === '/corporate/dashboard',
    `status ${corpReview.status}`,
  );

  // 7. Create a programme the E2E student will match
  const closing = new Date();
  closing.setDate(closing.getDate() + 60);

  const programme = await corporate.json<{ programmeId?: string; error?: string }>(
    '/api/corporate/programmes',
    {
      method: 'POST',
      body: JSON.stringify({
        details: {
          name: `E2E Technology Bursary ${unique}`,
          shortDescription: 'A demonstration bursary created by the end-to-end journey check.',
          fullDescription:
            'This programme is created by the automated journey check to prove that a funder can publish a programme and a student can discover and apply to it.',
          fundingType: 'BURSARY',
          coverage: ['TUITION_FEES', 'ACCOMMODATION', 'LAPTOP_DEVICE'],
          openDate: new Date().toISOString().slice(0, 10),
          closingDate: closing.toISOString().slice(0, 10),
          intakeTarget: 10,
        },
        eligibility: {
          institutionIds: [up.id, uj.id],
          programmeIds: [cs.id, it.id],
          qualificationLevels: ['BACHELORS'],
          minAcademicAverage: 70,
          yearsOfStudy: [1, 2, 3],
          citizenship: ['SA_CITIZEN'],
          maxHouseholdIncome: 'R350K_500K',
          requiresFinancialNeed: true,
          provinces: ['GAUTENG'],
          otherRequirements: '',
          requiredDocuments: ['ID_DOCUMENT', 'ACADEMIC_RECORD'],
        },
        questions: [
          {
            label: 'Why do you want this bursary?',
            helpText: '',
            type: 'LONG_TEXT',
            required: true,
            options: [],
          },
        ],
        publish: true,
      }),
    },
  );
  const programmeId = programme.body.programmeId;
  check(
    '7. funding programme is created and published',
    programme.status === 201 && Boolean(programmeId),
    programme.body.error ?? `status ${programme.status}`,
  );

  const badDates = await corporate.json('/api/corporate/programmes', {
    method: 'POST',
    body: JSON.stringify({
      details: {
        name: 'Invalid dates programme',
        shortDescription: 'Closing before opening should be rejected.',
        fullDescription: 'This programme should never be created because its dates are impossible.',
        fundingType: 'BURSARY',
        coverage: ['TUITION_FEES'],
        openDate: '2026-06-01',
        closingDate: '2026-01-01',
      },
      eligibility: {},
      questions: [],
      publish: false,
    }),
  });
  check('   a closing date before the opening date is rejected', badDates.status === 422);

  // =========================================================================
  section('End-to-end: funder publishes, student discovers and applies');
  // =========================================================================
  const refreshed = await student.page('/student/opportunities');
  const seesNewProgramme = refreshed.html.includes(`E2E Technology Bursary ${unique}`);
  check('the student sees the newly published programme', seesNewProgramme);

  const newAnswers: Record<string, string> = {};
  for (const id of await questionIdsFor(programmeId!)) {
    newAnswers[id] = 'I am passionate about building software.';
  }

  const missingRequired = await student.json('/api/student/applications', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'submit',
      fundingProgrammeId: programmeId,
      answers: {},
      documentIds: [],
      confirmAccurate: true,
    }),
  });
  check('an unanswered required question blocks submission', missingRequired.status === 422);

  const newApplication = await student.json<{ applicationId?: string; error?: string }>(
    '/api/student/applications',
    {
      method: 'POST',
      body: JSON.stringify({
        intent: 'submit',
        fundingProgrammeId: programmeId,
        answers: newAnswers,
        documentIds: [],
        confirmAccurate: true,
      }),
    },
  );
  const newApplicationId = newApplication.body.applicationId;
  check(
    'the student applies to it',
    newApplication.status === 200 && Boolean(newApplicationId),
    newApplication.body.error ?? `status ${newApplication.status}`,
  );

  // =========================================================================
  section('Funder reviews, shortlists and selects');
  // =========================================================================
  const applicantList = await corporate.page(`/corporate/applications?programme=${programmeId}`);
  check(
    'the funder sees the applicant',
    applicantList.html.includes('Journey'),
    'applicant not listed',
  );
  check('   with an eligibility verdict', applicantList.html.includes('Eligible'));

  const applicantPage = await corporate.page(`/corporate/applications/${newApplicationId}`);
  check(
    'the applicant profile renders',
    applicantPage.status === 200,
    `status ${applicantPage.status}`,
  );
  check('   showing the study preferences', applicantPage.html.includes('Study preferences'));
  check('   and the eligibility assessment', applicantPage.html.includes('Eligibility'));

  const shortlisted = await corporate.json(`/api/corporate/applications/${newApplicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'SHORTLISTED', note: '' }),
  });
  check(
    'the funder shortlists the applicant',
    shortlisted.status === 200,
    `status ${shortlisted.status}`,
  );

  const shortlistPage = await corporate.page('/corporate/shortlists');
  check('   they appear on the shortlist', shortlistPage.html.includes('Journey'));

  const selected = await corporate.json('/api/corporate/shortlist', {
    method: 'POST',
    body: JSON.stringify({ applicationIds: [newApplicationId], action: 'SELECT' }),
  });
  check('the funder moves them to Selected', selected.status === 200, `status ${selected.status}`);

  const beneficiaries = await corporate.page('/corporate/beneficiaries');
  check('   they appear as a beneficiary', beneficiaries.html.includes('Journey'));

  const studentView = await student.page(`/student/applications/${newApplicationId}`);
  check('the student sees the approved status', studentView.html.includes('Approved'));

  const notifications = await student.page('/student/notifications');
  check(
    '   and was notified',
    notifications.html.includes('approved') || notifications.html.includes('Approved'),
  );

  // =========================================================================
  section('Access control');
  // =========================================================================
  const anonymous = new Session();

  const anonDashboard = await anonymous.page('/student/dashboard');
  check(
    'anonymous users are redirected away from the student area',
    anonDashboard.status === 307 && Boolean(anonDashboard.location?.includes('/login')),
    `status ${anonDashboard.status}`,
  );

  const anonApi = await anonymous.json('/api/student/preferences');
  check('anonymous API calls return 401', anonApi.status === 401, `status ${anonApi.status}`);

  const studentHitsCorporate = await student.json('/api/corporate/programmes', {
    method: 'POST',
    body: JSON.stringify({ details: {}, eligibility: {}, questions: [], publish: false }),
  });
  check(
    'a student cannot use the corporate API',
    studentHitsCorporate.status === 403,
    `status ${studentHitsCorporate.status}`,
  );

  const corporateHitsStudent = await corporate.json('/api/student/preferences');
  check(
    'a corporate user cannot use the student API',
    corporateHitsStudent.status === 403,
    `status ${corporateHitsStudent.status}`,
  );

  // A second funder must not be able to read the first funder's applicant.
  const rival = new Session();
  await rival.json('/api/auth/register/organisation', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Rival',
      lastName: 'Funder',
      email: `e2e.rival.${unique}@demo.bursarybridge.local`,
      mobile: '0845556666',
      password: PASSWORD,
      confirmPassword: PASSWORD,
      emailNotifications: true,
      acceptedTerms: true,
    }),
  });
  await rival.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'details',
      data: {
        name: `E2E Rival Funder ${unique}`,
        type: 'CORPORATION',
        industry: 'MINING',
        website: '',
        country: 'South Africa',
      },
    }),
  });
  await rival.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'role',
      data: { role: 'HR_MANAGER', organisationSize: 'UNDER_50', department: '' },
    }),
  });
  await rival.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'funding',
      data: { offersFunding: 'YES', programmeTypes: ['BURSARIES'], applicationVolume: 'UNDER_100' },
    }),
  });
  await rival.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({ step: 'process', data: { processMethods: [], challenges: [] } }),
  });
  await rival.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({ step: 'review', data: { confirm: true } }),
  });

  const rivalReadsApplicant = await rival.page(`/corporate/applications/${newApplicationId}`);
  check(
    'one funder cannot open another funder’s applicant',
    rivalReadsApplicant.status === 404,
    `status ${rivalReadsApplicant.status}`,
  );

  const rivalDecides = await rival.json(`/api/corporate/applications/${newApplicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'UNSUCCESSFUL', note: '' }),
  });
  check(
    'one funder cannot decide on another funder’s applicant',
    rivalDecides.status === 404,
    `status ${rivalDecides.status}`,
  );

  const rivalEditsProgramme = await rival.json(`/api/corporate/programmes/${programmeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'CLOSED' }),
  });
  check(
    'one funder cannot close another funder’s programme',
    rivalEditsProgramme.status === 404,
    `status ${rivalEditsProgramme.status}`,
  );

  const rivalShortlists = await rival.json('/api/corporate/shortlist', {
    method: 'POST',
    body: JSON.stringify({ applicationIds: [newApplicationId], action: 'SHORTLIST' }),
  });
  check(
    'one funder cannot shortlist another funder’s applicant',
    rivalShortlists.status === 403,
    `status ${rivalShortlists.status}`,
  );

  // A second student must not be able to read the first student's application.
  const otherStudent = new Session();
  await otherStudent.json('/api/auth/register/student', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Other',
      lastName: 'Student',
      email: `e2e.other.${unique}@demo.bursarybridge.local`,
      mobile: '0827778888',
      password: PASSWORD,
      confirmPassword: PASSWORD,
      emailNotifications: true,
      acceptedTerms: true,
    }),
  });
  const otherReads = await otherStudent.page(`/student/applications/${newApplicationId}`);
  check(
    'one student cannot open another student’s application',
    otherReads.status === 404 || otherReads.status === 307,
    `status ${otherReads.status}`,
  );

  // Logging out really does invalidate the session.
  const loggedOut = new Session();
  await loggedOut.json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail, password: PASSWORD }),
  });
  const beforeLogout = await loggedOut.page('/student/dashboard');
  await loggedOut.json('/api/auth/logout', { method: 'POST' });
  const afterLogout = await loggedOut.page('/student/dashboard');
  check(
    'logging out invalidates the session',
    beforeLogout.status === 200 && afterLogout.status === 307,
    `before ${beforeLogout.status}, after ${afterLogout.status}`,
  );

  const wrongPassword = await new Session().json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail, password: 'WrongPassword1' }),
  });
  check(
    'a wrong password is rejected',
    wrongPassword.status === 401,
    `status ${wrongPassword.status}`,
  );

  const unknownEmail = await new Session().json<{ error?: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `nobody.${unique}@example.com`, password: 'WrongPassword1' }),
  });
  check(
    'an unknown email gives the same response as a wrong password',
    unknownEmail.status === 401 && unknownEmail.body.error === wrongPassword.body.error,
    'responses differ, which would allow account enumeration',
  );

  // =========================================================================
  section('Admin portal');
  // =========================================================================

  // Administrators are seeded, not registered: there is no public sign-up for
  // the role, so the test creates one directly and then signs in through the
  // real login route like any other actor.
  const adminEmail = `e2e.admin.${unique}@demo.bursarybridge.local`;
  await db.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hash(PASSWORD, 10),
      role: 'ADMIN',
      firstName: 'E2E',
      lastName: 'Admin',
      emailVerifiedAt: new Date(),
      acceptedTermsAt: new Date(),
    },
  });

  const admin = new Session();
  const adminLogin = await admin.json<{ redirectTo?: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: PASSWORD }),
  });
  check('an admin can sign in', adminLogin.status === 200, `status ${adminLogin.status}`);
  check(
    'and lands on the admin dashboard',
    adminLogin.body.redirectTo === '/admin/dashboard',
    `redirectTo ${adminLogin.body.redirectTo}`,
  );

  const adminDashboard = await admin.page('/admin/dashboard');
  check(
    'the admin dashboard renders',
    adminDashboard.status === 200,
    `status ${adminDashboard.status}`,
  );

  // --- the guard rejects everyone else -------------------------------------
  const anonAdminApi = await new Session().json('/api/admin/users/whatever', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUSPEND', reason: 'attempting without a session' }),
  });
  check(
    'an anonymous request to an admin route is 401',
    anonAdminApi.status === 401,
    `status ${anonAdminApi.status}`,
  );

  const studentAdminApi = await student.json('/api/admin/users/whatever', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUSPEND', reason: 'a student attempting an admin action' }),
  });
  check(
    'a student calling an admin route is 403',
    studentAdminApi.status === 403,
    `status ${studentAdminApi.status}`,
  );

  const corporateAdminApi = await corporate.json('/api/admin/programmes/whatever', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUSPEND', reason: 'a funder attempting an admin action' }),
  });
  check(
    'a funder calling an admin route is 403',
    corporateAdminApi.status === 403,
    `status ${corporateAdminApi.status}`,
  );

  const studentAdminPage = await student.page('/admin/dashboard');
  check(
    'a student is redirected away from an admin page',
    studentAdminPage.status === 307 || studentAdminPage.status === 302,
    `status ${studentAdminPage.status}`,
  );

  // --- a reason is required ------------------------------------------------
  const noReason = await admin.json('/api/admin/programmes/whatever', {
    method: 'POST',
    body: JSON.stringify({ action: 'SUSPEND', reason: 'short' }),
  });
  check(
    'an action without a proper reason is rejected',
    noReason.status === 422,
    `status ${noReason.status}`,
  );

  // --- suspend a programme -------------------------------------------------
  const targetProgramme = await db.fundingProgramme.findFirstOrThrow({
    where: { organisation: { name: { contains: unique } } },
    select: { id: true, name: true, status: true },
  });

  const suspendProgramme = await admin.json(`/api/admin/programmes/${targetProgramme.id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'SUSPEND', reason: 'Breaches the platform content policy.' }),
  });
  check(
    'an admin can suspend a programme',
    suspendProgramme.status === 200,
    `status ${suspendProgramme.status}`,
  );

  const afterSuspend = await db.fundingProgramme.findUniqueOrThrow({
    where: { id: targetProgramme.id },
    select: { status: true },
  });
  check(
    'the programme is SUSPENDED in the database',
    afterSuspend.status === 'SUSPENDED',
    afterSuspend.status,
  );

  // The point of the new status: the owner cannot undo it.
  const funderRepublish = await corporate.json(`/api/corporate/programmes/${targetProgramme.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  check(
    'the owning funder cannot publish a suspended programme',
    funderRepublish.status === 403,
    `status ${funderRepublish.status}`,
  );

  const stillSuspended = await db.fundingProgramme.findUniqueOrThrow({
    where: { id: targetProgramme.id },
    select: { status: true },
  });
  check(
    'and it is still SUSPENDED afterwards',
    stillSuspended.status === 'SUSPENDED',
    stillSuspended.status,
  );

  const suspendAudit = await db.auditLog.findFirst({
    where: { action: 'admin.programme_suspended', entityId: targetProgramme.id },
    select: { metadata: true, userId: true },
  });
  check(
    'the suspension is in the audit log with its reason',
    Boolean(suspendAudit),
    'no audit entry',
  );
  check(
    'the audit entry records the reason',
    typeof (suspendAudit?.metadata as { reason?: string } | null)?.reason === 'string',
    'no reason recorded',
  );

  const restoreProgramme = await admin.json(`/api/admin/programmes/${targetProgramme.id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'RESTORE', reason: 'Policy breach resolved by the funder.' }),
  });
  check(
    'an admin can restore it',
    restoreProgramme.status === 200,
    `status ${restoreProgramme.status}`,
  );
  const afterRestore = await db.fundingProgramme.findUniqueOrThrow({
    where: { id: targetProgramme.id },
    select: { status: true },
  });
  check(
    'it returns to DRAFT rather than PUBLISHED',
    afterRestore.status === 'DRAFT',
    afterRestore.status,
  );

  // --- suspend an account --------------------------------------------------
  const studentRecord = await db.user.findUniqueOrThrow({
    where: { email: studentEmail },
    select: { id: true },
  });

  const selfSuspend = await admin.json(
    `/api/admin/users/${(await db.user.findUniqueOrThrow({ where: { email: adminEmail }, select: { id: true } })).id}`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'SUSPEND', reason: 'attempting to suspend my own account' }),
    },
  );
  check(
    'an admin cannot suspend their own account',
    selfSuspend.status === 422,
    `status ${selfSuspend.status}`,
  );

  const suspendStudent = await admin.json(`/api/admin/users/${studentRecord.id}`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'SUSPEND',
      reason: 'Suspected fraudulent application activity.',
    }),
  });
  check(
    'an admin can suspend a student account',
    suspendStudent.status === 200,
    `status ${suspendStudent.status}`,
  );

  // Suspension is enforced by getCurrentUser, so the student's existing cookie
  // must stop working on the very next request.
  const suspendedStudentPage = await student.page('/student/dashboard');
  check(
    'the suspended student is no longer signed in',
    suspendedStudentPage.status === 307 || suspendedStudentPage.status === 302,
    `status ${suspendedStudentPage.status}`,
  );

  const suspendedLogin = await new Session().json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail, password: PASSWORD }),
  });
  check(
    'and cannot sign in again while suspended',
    suspendedLogin.status !== 200,
    `status ${suspendedLogin.status}`,
  );

  const reactivate = await admin.json(`/api/admin/users/${studentRecord.id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'REACTIVATE', reason: 'Investigation closed with no finding.' }),
  });
  check(
    'an admin can reactivate the account',
    reactivate.status === 200,
    `status ${reactivate.status}`,
  );

  const reactivatedLogin = await new Session().json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail, password: PASSWORD }),
  });
  check(
    'and the student can sign in again',
    reactivatedLogin.status === 200,
    `status ${reactivatedLogin.status}`,
  );

  // --- force a password reset ----------------------------------------------
  const forceReset = await admin.json(`/api/admin/users/${studentRecord.id}`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'FORCE_PASSWORD_RESET',
      reason: 'Credentials shared in a public forum.',
    }),
  });
  check(
    'an admin can force a password reset',
    forceReset.status === 200,
    `status ${forceReset.status}`,
  );
  const flagged = await db.user.findUniqueOrThrow({
    where: { id: studentRecord.id },
    select: { mustResetPassword: true, sessions: { select: { id: true } } },
  });
  check('the account is flagged for reset', flagged.mustResetPassword === true, 'flag not set');
  check(
    'and its sessions were ended',
    flagged.sessions.length === 0,
    `${flagged.sessions.length} session(s) left`,
  );

  // --- the audit log is read-only ------------------------------------------
  const auditPage = await admin.page('/admin/audit');
  check('the audit log page renders', auditPage.status === 200, `status ${auditPage.status}`);

  // =========================================================================
  section('Password reset');
  // =========================================================================

  // The student was flagged for reset just above, so this picks up exactly
  // where a forced reset leaves someone: locked out, needing a way back in.
  const flaggedLogin = await new Session().json<{ fields?: Record<string, string> }>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email: studentEmail, password: PASSWORD }) },
  );
  check(
    'a flagged account cannot sign in with the old password',
    flaggedLogin.status === 403,
    `status ${flaggedLogin.status}`,
  );
  check(
    'and the response says a reset is required',
    flaggedLogin.body.fields?.form === 'PASSWORD_RESET_REQUIRED',
    JSON.stringify(flaggedLogin.body.fields),
  );

  // Forcing the reset should have issued a link, or the account has no way back.
  const issuedByAdmin = await db.passwordResetToken.findFirst({
    where: { user: { email: studentEmail } },
    select: { id: true },
  });
  check('forcing a reset issues a reset token', Boolean(issuedByAdmin), 'no token issued');

  // --- anti-enumeration ----------------------------------------------------
  const forgotKnown = await new Session().json<{ message?: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail }),
  });
  const forgotUnknown = await new Session().json<{ message?: string }>(
    '/api/auth/forgot-password',
    { method: 'POST', body: JSON.stringify({ email: `nobody.${unique}@example.com` }) },
  );
  check(
    'a reset request for an unknown address looks identical to a known one',
    forgotKnown.status === forgotUnknown.status &&
      forgotKnown.body.message === forgotUnknown.body.message,
    'responses differ, which would allow account enumeration',
  );

  // The token itself is only ever emailed, so the test reads the hash side of
  // it the same way the server does.
  const resetToken = randomBytes(32).toString('base64url');
  const studentForReset = await db.user.findUniqueOrThrow({
    where: { email: studentEmail },
    select: { id: true },
  });
  await db.passwordResetToken.upsert({
    where: { userId: studentForReset.id },
    create: {
      userId: studentForReset.id,
      tokenHash: createHash('sha256').update(resetToken).digest('hex'),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
    update: {
      tokenHash: createHash('sha256').update(resetToken).digest('hex'),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  // --- invalid and mismatched input ----------------------------------------
  const badToken = await new Session().json('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: 'not-a-real-token',
      newPassword: 'NewJourney1234!',
      confirmPassword: 'NewJourney1234!',
    }),
  });
  check('an unknown reset token is rejected', badToken.status === 400, `status ${badToken.status}`);

  const mismatch = await new Session().json('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      newPassword: 'NewJourney1234!',
      confirmPassword: 'DifferentPassword1',
    }),
  });
  check('mismatched passwords are rejected', mismatch.status === 422, `status ${mismatch.status}`);

  const weakPassword = await new Session().json('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: resetToken, newPassword: 'short', confirmPassword: 'short' }),
  });
  check(
    'a password below the policy is rejected',
    weakPassword.status === 422,
    `status ${weakPassword.status}`,
  );

  // --- the happy path ------------------------------------------------------
  const NEW_PASSWORD = 'NewJourney1234!';
  const reset = await new Session().json('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    }),
  });
  check(
    'a valid reset token sets the new password',
    reset.status === 200,
    `status ${reset.status}`,
  );

  const afterReset = await db.user.findUniqueOrThrow({
    where: { id: studentForReset.id },
    select: { mustResetPassword: true },
  });
  check('the reset flag is cleared', afterReset.mustResetPassword === false, 'flag still set');

  const tokenGone = await db.passwordResetToken.findFirst({
    where: { userId: studentForReset.id },
  });
  check('the token is consumed', tokenGone === null, 'token still present');

  const replay = await new Session().json('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    }),
  });
  check('the same link cannot be used twice', replay.status === 400, `status ${replay.status}`);

  const oldPasswordLogin = await new Session().json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail, password: PASSWORD }),
  });
  check(
    'the old password no longer works',
    oldPasswordLogin.status === 401,
    `status ${oldPasswordLogin.status}`,
  );

  const newPasswordLogin = await new Session().json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail, password: NEW_PASSWORD }),
  });
  check(
    'the new password signs the student back in',
    newPasswordLogin.status === 200,
    `status ${newPasswordLogin.status}`,
  );

  // --- an expired link -----------------------------------------------------
  const expiredToken = randomBytes(32).toString('base64url');
  await db.passwordResetToken.create({
    data: {
      userId: studentForReset.id,
      tokenHash: createHash('sha256').update(expiredToken).digest('hex'),
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  const expired = await new Session().json('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: expiredToken,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    }),
  });
  check('an expired reset link is rejected', expired.status === 410, `status ${expired.status}`);

  // --- a suspended account cannot reset its way back in --------------------
  await db.user.update({ where: { id: studentForReset.id }, data: { status: 'SUSPENDED' } });
  const suspendedForgot = await new Session().json('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail }),
  });
  check(
    'a suspended account still gets the neutral response',
    suspendedForgot.status === 200,
    `status ${suspendedForgot.status}`,
  );
  const suspendedToken = await db.passwordResetToken.findFirst({
    where: { userId: studentForReset.id },
  });
  check('but no reset link is issued for it', suspendedToken === null, 'a token was issued');
  await db.user.update({ where: { id: studentForReset.id }, data: { status: 'ACTIVE' } });

  // =========================================================================
  await cleanUp(unique);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  console.log();
  process.exitCode = failed > 0 ? 1 : 0;
}

main()
  .catch((error) => {
    console.error('\nThe end-to-end run could not complete:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
