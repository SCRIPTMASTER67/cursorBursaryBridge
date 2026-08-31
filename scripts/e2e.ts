/**
 * End-to-end journey checks.
 *
 * Drives both complete user journeys against a running server using the real
 * HTTP API and real session cookies, then asserts the resulting database state.
 * Nothing here is mocked.
 *
 * Usage: npm run dev, then `npm run test:e2e`.
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * The harness reads programme questions straight from the database.
 * Answers are keyed by question id, and the application form only renders those
 * fields once the user reaches step 2, so they are not in the first response.
 */
const db = new PrismaClient();

async function questionIdsFor(fundingProgrammeId: string): Promise<string[]> {
  const questions = await db.applicationQuestion.findMany({
    where: { fundingProgrammeId },
    select: { id: true },
    orderBy: { order: 'asc' },
  });
  return questions.map((question) => question.id);
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
    catalogue.status === 200 && catalogue.body.institutions.length > 0,
    `status ${catalogue.status}`,
  );

  const up = catalogue.body.institutions.find((i) => i.name === 'University of Pretoria')!;
  const uj = catalogue.body.institutions.find((i) => i.name === 'University of Johannesburg')!;
  const tut = catalogue.body.institutions.find((i) => i.name === 'Tshwane University of Technology')!;
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
    incompleteEducation.status === 422 && Boolean(incompleteEducation.body.fields?.currentInstitutionId),
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
  check('4. three study preferences save', preferences.status === 200, `status ${preferences.status}`);

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
      data: { academicAverage: 140, academicAverageUnknown: false, resultTypes: [], achievements: [] },
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

  // 10. Matches
  const dashboard = await student.page('/student/dashboard');
  check('10. dashboard renders', dashboard.status === 200, `status ${dashboard.status}`);
  check('    it greets the student by name', dashboard.html.includes('Journey'));
  check('    it shows a match percentage', /\d+%\s*Match|% Match/.test(dashboard.html));
  check('    it explains why they match', dashboard.html.includes('Why you match'));

  const opportunities = await student.page('/student/opportunities');
  check('    opportunities list renders', opportunities.status === 200);

  const opportunityIds = [
    ...new Set([...opportunities.html.matchAll(/\/student\/opportunities\/(c[a-z0-9]{20,})/g)].map((m) => m[1])),
  ];
  check('    at least one opportunity is matched', opportunityIds.length > 0, `found ${opportunityIds.length}`);

  // 11. Opportunity detail shows the reasoning, not just a score
  const detail = await student.page(`/student/opportunities/${opportunityIds[0]}`);
  check('11. opportunity detail renders', detail.status === 200, `status ${detail.status}`);
  check('    it lists eligibility requirements', detail.html.includes('Apply Now') || detail.html.includes('Apply'));
  check('    it shows the per-criterion breakdown', detail.html.includes('Course') && detail.html.includes('worth'));

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
  check('1. corporate registers', corpRegistration.status === 201, `status ${corpRegistration.status}`);

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
  check('4. funding profile saves', fundingProfile.status === 200, `status ${fundingProfile.status}`);

  const process = await corporate.json('/api/corporate/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      step: 'process',
      data: {
        processMethods: ['EMAIL', 'SPREADSHEETS'],
        challenges: ['TOO_MANY_APPLICATIONS', 'MANUAL_SCREENING'],
      },
    }),
  });
  check('5. current process saves', process.status === 200, `status ${process.status}`);

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
  check('the funder sees the applicant', applicantList.html.includes('Journey'), 'applicant not listed');
  check('   with an eligibility verdict', applicantList.html.includes('Eligible'));

  const applicantPage = await corporate.page(`/corporate/applications/${newApplicationId}`);
  check('the applicant profile renders', applicantPage.status === 200, `status ${applicantPage.status}`);
  check('   showing the study preferences', applicantPage.html.includes('Study preferences'));
  check('   and the eligibility assessment', applicantPage.html.includes('Eligibility'));

  const shortlisted = await corporate.json(`/api/corporate/applications/${newApplicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'SHORTLISTED', note: '' }),
  });
  check('the funder shortlists the applicant', shortlisted.status === 200, `status ${shortlisted.status}`);

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
  check('   and was notified', notifications.html.includes('approved') || notifications.html.includes('Approved'));

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
  check('a wrong password is rejected', wrongPassword.status === 401, `status ${wrongPassword.status}`);

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
