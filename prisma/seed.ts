/**
 * Bursary-Bridge demo seed.
 *
 * Creates a realistic South African data set so the prototype is usable the
 * moment it is installed: the standardised catalogue, four demonstration
 * funders with published programmes, a spread of students, and applications at
 * every stage of the review pipeline.
 *
 * Every funder and funding programme here is FICTIONAL. Real organisations are
 * never represented as offering funding on this platform.
 */
import {
  PrismaClient,
  type ApplicationStatus,
  type CareerInterest,
  type Prisma,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { institutions, programmes } from './seed-data';

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';

/** Deterministic pseudo-random generator so reseeding produces the same data. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}
const random = makeRandom(20260831);

function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

function pickMany<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  while (chosen.length < count && pool.length > 0) {
    chosen.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return chosen;
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  console.log('Seeding Bursary-Bridge demo data…');

  // ---------------------------------------------------------------- reset
  // Ordered by dependency so foreign keys never block the truncate.
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.shortlist.deleteMany();
  await prisma.applicationDocument.deleteMany();
  await prisma.application.deleteMany();
  await prisma.document.deleteMany();
  await prisma.applicationQuestion.deleteMany();
  await prisma.eligibilityRule.deleteMany();
  await prisma.fundingProgrammeInstitution.deleteMany();
  await prisma.fundingProgrammeProgramme.deleteMany();
  await prisma.fundingProgramme.deleteMany();
  await prisma.studyPreference.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.corporateProfile.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.institution.deleteMany();
  await prisma.programme.deleteMany();

  // ------------------------------------------------------------- catalogue
  await prisma.institution.createMany({ data: institutions });
  await prisma.programme.createMany({ data: programmes });

  const institutionRows = await prisma.institution.findMany();
  const programmeRows = await prisma.programme.findMany();

  const inst = (name: string) => {
    const row = institutionRows.find((i) => i.name === name);
    if (!row) throw new Error(`Seed error: unknown institution "${name}"`);
    return row;
  };
  const prog = (name: string) => {
    const row = programmeRows.find((p) => p.name === name);
    if (!row) throw new Error(`Seed error: unknown programme "${name}"`);
    return row;
  };

  console.log(`  catalogue: ${institutionRows.length} institutions, ${programmeRows.length} courses`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---------------------------------------------------------- organisations
  const organisationSeeds: {
    name: string;
    type: Prisma.OrganisationCreateInput['type'];
    industry: Prisma.OrganisationCreateInput['industry'];
    website: string;
    description: string;
    manager: { firstName: string; lastName: string; email: string; mobile: string; role: Prisma.CorporateProfileCreateInput['role']; department: string };
    size: Prisma.CorporateProfileCreateInput['organisationSize'];
    volume: Prisma.OrganisationCreateInput['applicationVolume'];
  }[] = [
    {
      name: 'Kgotso Holdings',
      type: 'CORPORATION',
      industry: 'FINANCIAL_SERVICES',
      website: 'https://www.kgotsoholdings.example',
      description:
        'A demonstration financial services group investing in South African talent through bursaries and graduate programmes.',
      manager: {
        firstName: 'Sarah',
        lastName: 'Dlamini',
        email: 'corporate@demo.bursarybridge.local',
        mobile: '0823456789',
        role: 'CSI_MANAGER',
        department: 'Corporate Social Investment / CSI',
      },
      size: 'SIZE_251_1000',
      volume: 'V1001_5000',
    },
    {
      name: 'Umoya Energy',
      type: 'CORPORATION',
      industry: 'ENERGY',
      website: 'https://www.umoyaenergy.example',
      description:
        'A demonstration renewable energy company funding engineering and science students across South Africa.',
      manager: {
        firstName: 'Thabo',
        lastName: 'Mokoena',
        email: 'umoya@demo.bursarybridge.local',
        mobile: '0834567890',
        role: 'BURSARY_FUNDING_MANAGER',
        department: 'Transformation & Skills',
      },
      size: 'SIZE_1001_5000',
      volume: 'V501_1000',
    },
    {
      name: 'Thuto Foundation',
      type: 'FOUNDATION',
      industry: 'PROFESSIONAL_SERVICES',
      website: 'https://www.thutofoundation.example',
      description:
        'A demonstration education foundation supporting first-generation students from under-resourced communities.',
      manager: {
        firstName: 'Nomvula',
        lastName: 'Khumalo',
        email: 'thuto@demo.bursarybridge.local',
        mobile: '0845678901',
        role: 'FOUNDATION_MANAGER',
        department: 'Programmes',
      },
      size: 'UNDER_50',
      volume: 'V100_500',
    },
    {
      name: 'Amandla Mining Group',
      type: 'CORPORATION',
      industry: 'MINING',
      website: 'https://www.amandlamining.example',
      description:
        'A demonstration mining group funding engineering, geology and metallurgy studies near its operations.',
      manager: {
        firstName: 'Pieter',
        lastName: 'van Wyk',
        email: 'amandla@demo.bursarybridge.local',
        mobile: '0856789012',
        role: 'TALENT_MANAGER',
        department: 'Human Resources',
      },
      size: 'ABOVE_5000',
      volume: 'V1001_5000',
    },
  ];

  const organisations: Record<string, { id: string; userId: string }> = {};

  for (const seed of organisationSeeds) {
    const organisation = await prisma.organisation.create({
      data: {
        name: seed.name,
        type: seed.type,
        industry: seed.industry,
        website: seed.website,
        description: seed.description,
        country: 'South Africa',
        offersFunding: 'YES',
        programmeTypes: ['BURSARIES', 'SCHOLARSHIPS', 'INTERNSHIPS'],
        applicationVolume: seed.volume,
        processMethods: ['EMAIL', 'SPREADSHEETS', 'MANUAL_PROCESS'],
        challenges: ['TOO_MANY_APPLICATIONS', 'MANUAL_SCREENING', 'DOCUMENT_VERIFICATION'],
      },
    });

    const user = await prisma.user.create({
      data: {
        email: seed.manager.email,
        passwordHash,
        role: 'CORPORATE',
        firstName: seed.manager.firstName,
        lastName: seed.manager.lastName,
        mobile: seed.manager.mobile,
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        corporateProfile: {
          create: {
            organisationId: organisation.id,
            role: seed.manager.role,
            department: seed.manager.department,
            organisationSize: seed.size,
            onboardingStep: 'review',
            onboardingCompletedAt: new Date(),
          },
        },
      },
    });

    organisations[seed.name] = { id: organisation.id, userId: user.id };
  }

  console.log(`  organisations: ${organisationSeeds.length}`);

  // ------------------------------------------------------- funding programmes
  type ProgrammeSeed = {
    org: string;
    name: string;
    slug: string;
    shortDescription: string;
    fullDescription: string;
    fundingType: Prisma.FundingProgrammeCreateInput['fundingType'];
    coverage: Prisma.FundingProgrammeCreateInput['coverage'];
    openDays: number;
    closeDays: number;
    status: Prisma.FundingProgrammeCreateInput['status'];
    intakeTarget: number;
    institutions: string[];
    courses: string[];
    eligibility: Omit<Prisma.EligibilityRuleCreateInput, 'fundingProgramme'>;
    questions: { label: string; helpText?: string; type: Prisma.ApplicationQuestionCreateInput['type']; required: boolean; options?: string[] }[];
  };

  const programmeSeeds: ProgrammeSeed[] = [
    {
      org: 'Kgotso Holdings',
      name: '2026 Technology Bursary Programme',
      slug: 'kgotso-technology-bursary-2026',
      shortDescription:
        'Full funding for students pursuing technology and data qualifications at partner universities.',
      fullDescription:
        'The Kgotso Holdings Technology Bursary supports deserving South African students who demonstrate academic excellence and financial need. We invest in future leaders in technology and related fields, and successful applicants join our graduate programme after completing their studies. The bursary covers the full cost of study and includes a mentorship pairing with a member of our technology team.',
      fundingType: 'BURSARY',
      coverage: ['TUITION_FEES', 'REGISTRATION_FEES', 'ACCOMMODATION', 'MEALS_LIVING', 'BOOKS_MATERIALS', 'LAPTOP_DEVICE'],
      openDays: -90,
      closeDays: 30,
      status: 'PUBLISHED',
      intakeTarget: 40,
      institutions: [
        'University of Pretoria',
        'University of Johannesburg',
        'University of the Witwatersrand',
        'University of Cape Town',
        'Tshwane University of Technology',
      ],
      courses: ['Computer Science', 'Information Technology', 'Information Systems', 'Data Science', 'Software Engineering'],
      eligibility: {
        minAcademicAverage: 70,
        qualificationLevels: ['BACHELORS', 'HONOURS'],
        yearsOfStudy: [1, 2, 3, 4],
        citizenship: ['SA_CITIZEN', 'PERMANENT_RESIDENT'],
        maxHouseholdIncome: 'R350K_500K',
        requiresFinancialNeed: true,
        provinces: [],
        otherRequirements:
          'Applicants must be willing to complete a 10-week vacation internship at a Kgotso Holdings office during their studies.',
        requiredDocuments: ['ID_DOCUMENT', 'ACADEMIC_RECORD', 'PROOF_OF_INCOME'],
      },
      questions: [
        {
          label: 'Why are you interested in a career in technology?',
          helpText: 'Around 200 words. Tell us what drew you to the field.',
          type: 'LONG_TEXT',
          required: true,
        },
        {
          label: 'Are you available for a vacation internship during your studies?',
          type: 'YES_NO',
          required: true,
        },
      ],
    },
    {
      org: 'Kgotso Holdings',
      name: 'Chartered Accountancy Scholarship',
      slug: 'kgotso-ca-scholarship-2026',
      shortDescription:
        'Scholarship for accounting students working towards the CA(SA) qualification.',
      fullDescription:
        'This scholarship supports students on the path to becoming Chartered Accountants. It covers tuition, prescribed textbooks and a monthly allowance, and includes a guaranteed articles placement at Kgotso Holdings on successful completion of the degree.',
      fundingType: 'SCHOLARSHIP',
      coverage: ['TUITION_FEES', 'BOOKS_MATERIALS', 'MEALS_LIVING'],
      openDays: -60,
      closeDays: 75,
      status: 'PUBLISHED',
      intakeTarget: 15,
      institutions: ['University of Pretoria', 'University of Cape Town', 'Stellenbosch University', 'University of Johannesburg'],
      courses: ['Accounting', 'Financial Management', 'Economics'],
      eligibility: {
        minAcademicAverage: 75,
        qualificationLevels: ['BACHELORS', 'HONOURS'],
        yearsOfStudy: [1, 2, 3],
        citizenship: ['SA_CITIZEN'],
        maxHouseholdIncome: 'R200K_350K',
        requiresFinancialNeed: true,
        provinces: [],
        otherRequirements: 'Applicants must have achieved at least 70% for Mathematics in matric.',
        requiredDocuments: ['ID_DOCUMENT', 'MATRIC_CERTIFICATE', 'ACADEMIC_RECORD'],
      },
      questions: [
        {
          label: 'What is your matric Mathematics result?',
          type: 'NUMBER',
          required: true,
        },
      ],
    },
    {
      org: 'Umoya Energy',
      name: 'Renewable Energy Engineering Bursary',
      slug: 'umoya-engineering-bursary-2026',
      shortDescription:
        'Supporting engineering students who want to build South Africa’s renewable energy future.',
      fullDescription:
        'Umoya Energy funds engineering students across electrical, mechanical and chemical disciplines. Bursars receive full tuition, accommodation and a laptop allowance, and are invited to an annual technical summit with our engineering teams.',
      fundingType: 'BURSARY',
      coverage: ['TUITION_FEES', 'ACCOMMODATION', 'LAPTOP_DEVICE', 'TRANSPORT'],
      openDays: -45,
      closeDays: 55,
      status: 'PUBLISHED',
      intakeTarget: 25,
      institutions: [
        'University of Pretoria',
        'Stellenbosch University',
        'University of Cape Town',
        'North-West University',
        'University of KwaZulu-Natal',
        'Cape Peninsula University of Technology',
      ],
      courses: ['Electrical Engineering', 'Mechanical Engineering', 'Chemical Engineering', 'Computer Engineering', 'Industrial Engineering'],
      eligibility: {
        minAcademicAverage: 65,
        qualificationLevels: ['BACHELORS', 'HONOURS', 'MASTERS'],
        yearsOfStudy: [1, 2, 3, 4],
        citizenship: ['SA_CITIZEN', 'PERMANENT_RESIDENT'],
        maxHouseholdIncome: null,
        requiresFinancialNeed: false,
        provinces: [],
        otherRequirements: null,
        requiredDocuments: ['ID_DOCUMENT', 'ACADEMIC_RECORD', 'PROOF_OF_REGISTRATION'],
      },
      questions: [
        {
          label: 'Which area of renewable energy interests you most?',
          type: 'SINGLE_SELECT',
          required: true,
          options: ['Solar', 'Wind', 'Battery storage', 'Grid infrastructure', 'Green hydrogen'],
        },
      ],
    },
    {
      org: 'Thuto Foundation',
      name: 'First-Generation Student Grant',
      slug: 'thuto-first-generation-grant-2026',
      shortDescription:
        'A grant for first-generation students from households earning under R200,000 a year.',
      fullDescription:
        'The Thuto Foundation exists to remove the financial barriers facing the first person in a family to attend university. This grant covers registration and tuition fees and provides a monthly living allowance. We welcome applicants from every field of study.',
      fundingType: 'GRANT',
      coverage: ['TUITION_FEES', 'REGISTRATION_FEES', 'MEALS_LIVING', 'BOOKS_MATERIALS'],
      openDays: -30,
      closeDays: 14,
      status: 'PUBLISHED',
      intakeTarget: 60,
      institutions: [],
      courses: [],
      eligibility: {
        minAcademicAverage: 60,
        qualificationLevels: [],
        yearsOfStudy: [],
        citizenship: ['SA_CITIZEN'],
        maxHouseholdIncome: 'R100K_200K',
        requiresFinancialNeed: true,
        provinces: [],
        otherRequirements:
          'Applicants must be the first person in their immediate family to attend a tertiary institution.',
        requiredDocuments: ['ID_DOCUMENT', 'PROOF_OF_INCOME', 'PROOF_OF_RESIDENCE'],
      },
      questions: [
        {
          label: 'Tell us about your journey to university.',
          helpText: 'Share what getting to this point has meant for you and your family.',
          type: 'LONG_TEXT',
          required: true,
        },
      ],
    },
    {
      org: 'Amandla Mining Group',
      name: 'Mining & Geoscience Bursary',
      slug: 'amandla-mining-bursary-2026',
      shortDescription:
        'Full-cost bursary for mining engineering, metallurgy and geology students.',
      fullDescription:
        'Amandla Mining Group funds students in mining engineering, metallurgical engineering and geology. Bursars complete practical placements at our operations and are offered permanent employment on graduation. Preference is given to students from the provinces where we operate.',
      fundingType: 'BURSARY',
      coverage: ['TUITION_FEES', 'REGISTRATION_FEES', 'ACCOMMODATION', 'MEALS_LIVING', 'BOOKS_MATERIALS', 'TRANSPORT'],
      openDays: -20,
      closeDays: 95,
      status: 'PUBLISHED',
      intakeTarget: 20,
      institutions: ['University of the Witwatersrand', 'University of Pretoria', 'University of Johannesburg', 'University of the Free State'],
      courses: ['Mining Engineering', 'Metallurgical Engineering', 'Geology', 'Chemical Engineering'],
      eligibility: {
        minAcademicAverage: 68,
        qualificationLevels: ['BACHELORS', 'HONOURS'],
        yearsOfStudy: [1, 2, 3, 4],
        citizenship: ['SA_CITIZEN'],
        maxHouseholdIncome: 'R350K_500K',
        requiresFinancialNeed: true,
        provinces: ['GAUTENG', 'NORTH_WEST', 'LIMPOPO', 'MPUMALANGA', 'FREE_STATE', 'NORTHERN_CAPE'],
        otherRequirements: 'Applicants must be medically fit for underground work.',
        requiredDocuments: ['ID_DOCUMENT', 'ACADEMIC_RECORD', 'PROOF_OF_RESIDENCE'],
      },
      questions: [],
    },
    {
      org: 'Umoya Energy',
      name: 'Science Postgraduate Scholarship',
      slug: 'umoya-science-postgraduate-2026',
      shortDescription: 'Research funding for postgraduate students in the physical sciences.',
      fullDescription:
        'A scholarship for Honours and Master’s students conducting research relevant to energy systems, materials or environmental science. Recipients receive tuition and a research stipend.',
      fundingType: 'SCHOLARSHIP',
      coverage: ['TUITION_FEES', 'MEALS_LIVING'],
      openDays: 10,
      closeDays: 120,
      status: 'DRAFT',
      intakeTarget: 8,
      institutions: ['University of Cape Town', 'Stellenbosch University', 'University of the Witwatersrand'],
      courses: ['Physics', 'Chemistry', 'Environmental Science', 'Mathematics'],
      eligibility: {
        minAcademicAverage: 72,
        qualificationLevels: ['HONOURS', 'MASTERS'],
        yearsOfStudy: [],
        citizenship: ['SA_CITIZEN', 'PERMANENT_RESIDENT'],
        maxHouseholdIncome: null,
        requiresFinancialNeed: false,
        provinces: [],
        otherRequirements: null,
        requiredDocuments: ['ID_DOCUMENT', 'TRANSCRIPT', 'CV'],
      },
      questions: [],
    },
  ];

  const createdProgrammes: { id: string; slug: string; organisationId: string; name: string }[] = [];

  for (const seed of programmeSeeds) {
    const organisation = organisations[seed.org];
    const created = await prisma.fundingProgramme.create({
      data: {
        organisationId: organisation.id,
        createdById: organisation.userId,
        name: seed.name,
        slug: seed.slug,
        shortDescription: seed.shortDescription,
        fullDescription: seed.fullDescription,
        fundingType: seed.fundingType,
        coverage: seed.coverage,
        openDate: daysFromNow(seed.openDays),
        closingDate: daysFromNow(seed.closeDays),
        status: seed.status,
        intakeTarget: seed.intakeTarget,
        eligibility: { create: seed.eligibility },
        supportedInstitutions: {
          create: seed.institutions.map((name) => ({ institutionId: inst(name).id })),
        },
        supportedProgrammes: {
          create: seed.courses.map((name) => ({ programmeId: prog(name).id })),
        },
        questions: {
          create: seed.questions.map((question, index) => ({
            label: question.label,
            helpText: question.helpText,
            type: question.type,
            required: question.required,
            options: question.options ?? [],
            order: index + 1,
          })),
        },
      },
      select: { id: true, slug: true, organisationId: true, name: true },
    });
    createdProgrammes.push(created);
  }

  console.log(`  funding programmes: ${createdProgrammes.length}`);

  await seedStudents({ inst, prog, passwordHash, createdProgrammes, organisations });

  console.log('\nDemo accounts (password: %s)', DEMO_PASSWORD);
  console.log('  Student   student@demo.bursarybridge.local');
  console.log('  Corporate corporate@demo.bursarybridge.local');
  console.log('\nSeeding complete.');
}

// ===========================================================================
// Students & applications
// ===========================================================================

async function seedStudents({
  inst,
  prog,
  passwordHash,
  createdProgrammes,
  organisations,
}: {
  inst: (name: string) => { id: string; province: Prisma.InstitutionCreateInput['province'] };
  prog: (name: string) => { id: string; field: CareerInterest };
  passwordHash: string;
  createdProgrammes: { id: string; slug: string; organisationId: string; name: string }[];
  organisations: Record<string, { id: string; userId: string }>;
}) {
  const firstNames = [
    'Asanda', 'Liam', 'Nomusa', 'Thabo', 'Megan', 'Sipho', 'Lerato', 'Ayesha', 'Kagiso', 'Chloé',
    'Tumelo', 'Zanele', 'Ruan', 'Naledi', 'Farhaan', 'Palesa', 'Jaco', 'Refilwe', 'Nkosi', 'Amahle',
    'Bongani', 'Michelle', 'Sizwe', 'Kirsten', 'Mpho', 'Dineo', 'Tebogo', 'Anele', 'Rethabile', 'Karabo',
  ];
  const lastNames = [
    'Nsibande', 'Jacobs', 'Zulu', 'Mokoena', 'Pillay', 'Ndlovu', 'Mahlangu', 'Naidoo', 'Botha', 'Sithole',
    'Mabaso', 'Van Zyl', 'Khoza', 'Adams', 'Mthembu', 'Fourie', 'Radebe', 'Petersen', 'Dube', 'Motaung',
  ];

  const preferenceSets: { courses: string[]; institutions: string[] }[] = [
    {
      courses: ['Computer Science', 'Computer Science', 'Information Technology', 'Data Science'],
      institutions: ['University of Pretoria', 'University of Johannesburg', 'Tshwane University of Technology', 'University of the Witwatersrand'],
    },
    {
      courses: ['Electrical Engineering', 'Mechanical Engineering', 'Computer Engineering'],
      institutions: ['University of Cape Town', 'Stellenbosch University', 'University of Pretoria'],
    },
    {
      courses: ['Accounting', 'Financial Management', 'Economics'],
      institutions: ['University of Pretoria', 'Stellenbosch University', 'University of Cape Town'],
    },
    {
      courses: ['Mining Engineering', 'Geology', 'Metallurgical Engineering'],
      institutions: ['University of the Witwatersrand', 'University of Johannesburg', 'University of Pretoria'],
    },
    {
      courses: ['Nursing', 'Medicine', 'Pharmacy'],
      institutions: ['University of KwaZulu-Natal', 'University of Cape Town', 'Nelson Mandela University'],
    },
    {
      courses: ['Law', 'Public Administration'],
      institutions: ['University of the Western Cape', 'Rhodes University'],
    },
    {
      courses: ['Education', 'Business Management'],
      institutions: ['North-West University', 'University of the Free State'],
    },
    {
      courses: ['Software Engineering', 'Cyber Security', 'Information Systems'],
      institutions: ['University of Cape Town', 'University of Pretoria', 'North-West University'],
    },
  ];

  const provinces = ['GAUTENG', 'WESTERN_CAPE', 'KWAZULU_NATAL', 'EASTERN_CAPE', 'LIMPOPO', 'NORTH_WEST', 'FREE_STATE', 'MPUMALANGA'] as const;
  const cities: Record<string, string> = {
    GAUTENG: 'Pretoria',
    WESTERN_CAPE: 'Cape Town',
    KWAZULU_NATAL: 'Durban',
    EASTERN_CAPE: 'Gqeberha',
    LIMPOPO: 'Polokwane',
    NORTH_WEST: 'Rustenburg',
    FREE_STATE: 'Bloemfontein',
    MPUMALANGA: 'Mbombela',
  };
  const incomes = ['BELOW_50K', 'R50K_100K', 'R100K_200K', 'R200K_350K', 'R350K_500K', 'ABOVE_500K'] as const;

  const students: { studentProfileId: string; userId: string }[] = [];

  // The headline demo student, matching the reference designs.
  const demoStudentProfile = await createStudent({
    firstName: 'Asanda',
    lastName: 'Nsibande',
    email: 'student@demo.bursarybridge.local',
    mobile: '0821234567',
    average: 82,
    province: 'GAUTENG',
    city: 'Pretoria',
    income: 'R100K_200K',
    preferenceSet: preferenceSets[0],
    yearOfStudy: 2,
    currentInstitution: 'University of Pretoria',
    currentProgramme: 'Computer Science',
  });
  students.push(demoStudentProfile);

  for (let index = 0; index < 39; index += 1) {
    const preferenceSet = pick(preferenceSets);
    const province = pick([...provinces]);
    const first = pick(firstNames);
    const last = pick(lastNames);
    const student = await createStudent({
      firstName: first,
      lastName: last,
      email: `${first}.${last}.${index}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + '@demo.bursarybridge.local',
      mobile: `08${Math.floor(random() * 4) + 2}${String(Math.floor(random() * 9_999_999)).padStart(7, '0')}`,
      average: 55 + Math.floor(random() * 42),
      province,
      city: cities[province],
      income: pick([...incomes]),
      preferenceSet,
      yearOfStudy: 1 + Math.floor(random() * 4),
      currentInstitution: preferenceSet.institutions[0],
      currentProgramme: preferenceSet.courses[0],
      incompleteProfile: random() < 0.18,
    });
    students.push(student);
  }

  console.log(`  students: ${students.length}`);

  async function createStudent(input: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    average: number;
    province: (typeof provinces)[number];
    city: string;
    income: (typeof incomes)[number];
    preferenceSet: { courses: string[]; institutions: string[] };
    yearOfStudy: number;
    currentInstitution: string;
    currentProgramme: string;
    /**
     * Leaves the financial and academic fields blank, so the eligibility
     * service reports PENDING_VERIFICATION rather than a pass or a fail —
     * the behaviour that stops an incomplete profile being auto-rejected.
     */
    incompleteProfile?: boolean;
  }) {
    const preferenceCount = Math.min(input.preferenceSet.courses.length, input.preferenceSet.institutions.length);
    const interests = [...new Set(input.preferenceSet.courses.map((name) => prog(name).field))].slice(0, 5);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: 'STUDENT',
        firstName: input.firstName,
        lastName: input.lastName,
        mobile: input.mobile,
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
        studentProfile: {
          create: {
            educationStage: 'UNIVERSITY_CURRENT',
            qualificationLevel: 'BACHELORS',
            studyStatus: 'CURRENTLY_ENROLLED',
            currentInstitutionId: inst(input.currentInstitution).id,
            currentProgrammeId: prog(input.currentProgramme).id,
            yearOfStudy: input.yearOfStudy,
            academicAverage: input.incompleteProfile ? null : input.average,
            academicAverageUnknown: input.incompleteProfile ?? false,
            resultTypes: input.incompleteProfile ? [] : ['MATRIC_RESULTS', 'UNIVERSITY_TRANSCRIPT'],
            achievements:
              !input.incompleteProfile && input.average >= 75
                ? ['SUBJECT_DISTINCTIONS', 'ACADEMIC_AWARDS']
                : [],
            fundingNeeds: ['TUITION_FEES', 'ACCOMMODATION', 'BOOKS_MATERIALS', 'MEALS_LIVING', 'FULL_FUNDING'],
            fundingSituation: 'NO_FUNDING',
            bursaryStatus: 'NO',
            householdIncome: input.incompleteProfile ? null : input.income,
            dateOfBirth: new Date(2004, Math.floor(random() * 12), 1 + Math.floor(random() * 27)),
            citizenship: input.incompleteProfile ? null : 'SA_CITIZEN',
            firstGeneration: random() > 0.5 ? 'YES' : 'NO',
            disability: 'NO',
            orphanVulnerable: 'NO',
            province: input.province,
            city: input.city,
            studyLocationPreference: 'SAME_LOCATION',
            careerInterests: interests,
            onboardingStep: 'review',
            onboardingCompletedAt: new Date(),
            profileStrength: input.incompleteProfile ? 55 : 85,
            studyPreferences: {
              create: Array.from({ length: preferenceCount }, (_, i) => ({
                preferenceNumber: i + 1,
                programmeId: prog(input.preferenceSet.courses[i]).id,
                institutionId: inst(input.preferenceSet.institutions[i]).id,
              })),
            },
          },
        },
      },
      select: { id: true, studentProfile: { select: { id: true } } },
    });

    return { userId: user.id, studentProfileId: user.studentProfile!.id };
  }

  // ------------------------------------------------------------ applications
  const publishedProgrammes = createdProgrammes.filter((p) =>
    ['kgotso-technology-bursary-2026', 'kgotso-ca-scholarship-2026', 'umoya-engineering-bursary-2026', 'thuto-first-generation-grant-2026', 'amandla-mining-bursary-2026'].includes(p.slug),
  );

  const statusPlan: ApplicationStatus[] = [
    'SUBMITTED', 'SUBMITTED', 'SUBMITTED', 'SUBMITTED',
    'UNDER_REVIEW', 'UNDER_REVIEW', 'UNDER_REVIEW',
    'SHORTLISTED', 'SHORTLISTED',
    'DOCUMENTS_REQUIRED',
    'APPROVED',
    'UNSUCCESSFUL',
  ];

  // Score each application with the real engine so the funder dashboards show
  // meaningful match percentages rather than invented numbers.
  const { MatchingService } = await import('../lib/matching/engine');
  const { EligibilityService } = await import('../lib/matching/eligibility');
  const { toMatchableProgramme } = await import('../lib/matching/adapters');

  const programmeRecords = await prisma.fundingProgramme.findMany({
    where: { id: { in: publishedProgrammes.map((p) => p.id) } },
    include: {
      organisation: { select: { id: true, name: true, logoUrl: true, industry: true } },
      eligibility: true,
      supportedProgrammes: { include: { programme: { select: { id: true, name: true } } } },
      supportedInstitutions: { include: { institution: { select: { id: true, name: true, shortName: true } } } },
    },
  });

  let applicationCount = 0;
  let shortlistCount = 0;

  for (const student of students) {
    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { id: student.studentProfileId },
      select: {
        currentProgrammeId: true,
        currentInstitutionId: true,
        qualificationLevel: true,
        academicAverage: true,
        province: true,
        householdIncome: true,
        citizenship: true,
        yearOfStudy: true,
        studyPreferences: {
          select: { preferenceNumber: true, programmeId: true, institutionId: true },
          orderBy: { preferenceNumber: 'asc' },
        },
      },
    });

    const matchable = {
      studyPreferences: profile.studyPreferences,
      currentProgrammeId: profile.currentProgrammeId,
      currentInstitutionId: profile.currentInstitutionId,
      qualificationLevel: profile.qualificationLevel,
      academicAverage: profile.academicAverage,
      province: profile.province,
      householdIncome: profile.householdIncome,
      citizenship: profile.citizenship,
      yearOfStudy: profile.yearOfStudy,
    };

    // Students apply to their better matches, but not only to perfect ones —
    // real funders receive plenty of applications that fail their criteria, and
    // the dashboards should reflect that.
    const ranked = programmeRecords
      .map((programme) => ({
        programme,
        match: MatchingService.score(matchable, toMatchableProgramme(programme)),
        eligibility: EligibilityService.evaluate(matchable, toMatchableProgramme(programme)),
      }))
      .filter((entry) => entry.match.matchScore >= 40)
      .sort((a, b) => b.match.matchScore - a.match.matchScore)
      .slice(0, 1 + Math.floor(random() * 3));

    for (const entry of ranked) {
      const status = pick(statusPlan);
      const submittedAt = new Date(Date.now() - Math.floor(random() * 40) * 86_400_000);

      const application = await prisma.application.create({
        data: {
          studentProfileId: student.studentProfileId,
          fundingProgrammeId: entry.programme.id,
          organisationId: entry.programme.organisationId,
          status,
          matchScore: entry.match.matchScore,
          matchClassification: entry.match.classification,
          matchReasons: entry.match.criteria as unknown as Prisma.InputJsonValue,
          eligibilityOutcome: entry.eligibility.outcome,
          answers: {},
          submittedAt,
          lastStatusChangeAt: submittedAt,
        },
        select: { id: true },
      });
      applicationCount += 1;

      if (status === 'SHORTLISTED' || status === 'APPROVED') {
        await prisma.shortlist.create({
          data: {
            organisationId: entry.programme.organisationId,
            fundingProgrammeId: entry.programme.id,
            applicationId: application.id,
            addedById: Object.values(organisations).find((o) => o.id === entry.programme.organisationId)?.userId,
            status: status === 'APPROVED' ? 'SELECTED' : 'SHORTLISTED',
            selectedAt: status === 'APPROVED' ? new Date() : null,
          },
        });
        shortlistCount += 1;
      }
    }
  }

  const outcomeSpread = await prisma.application.groupBy({
    by: ['eligibilityOutcome'],
    where: { status: { not: 'DRAFT' } },
    _count: { _all: true },
  });
  const spread = outcomeSpread
    .map((row) => `${row.eligibilityOutcome ?? 'UNSCORED'}=${row._count._all}`)
    .join(', ');
  console.log(`  applications: ${applicationCount} (${shortlistCount} shortlisted or selected)`);
  console.log(`  eligibility spread: ${spread}`);

  // A draft application for the demo student, so "My Applications" shows one.
  const demoDraftProgramme = createdProgrammes.find((p) => p.slug === 'amandla-mining-bursary-2026');
  if (demoDraftProgramme) {
    const existing = await prisma.application.findUnique({
      where: {
        studentProfileId_fundingProgrammeId: {
          studentProfileId: students[0].studentProfileId,
          fundingProgrammeId: demoDraftProgramme.id,
        },
      },
      select: { id: true },
    });
    if (!existing) {
      await prisma.application.create({
        data: {
          studentProfileId: students[0].studentProfileId,
          fundingProgrammeId: demoDraftProgramme.id,
          organisationId: demoDraftProgramme.organisationId,
          status: 'DRAFT',
          answers: {},
        },
      });
    }
  }

  // ----------------------------------------------------------- notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: students[0].userId,
        type: 'NEW_MATCH',
        title: 'New opportunity matched to your profile',
        body: 'The 2026 Technology Bursary Programme is a strong match for your study preferences.',
        link: '/student/opportunities',
      },
      {
        userId: students[0].userId,
        type: 'DEADLINE_APPROACHING',
        title: 'A deadline is approaching',
        body: 'The First-Generation Student Grant closes in 14 days.',
        link: '/student/opportunities',
      },
      {
        userId: organisations['Kgotso Holdings'].userId,
        type: 'APPLICATION_SUBMITTED',
        title: 'New applications received',
        body: 'You have new applications waiting for review on the 2026 Technology Bursary Programme.',
        link: '/corporate/applications',
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
