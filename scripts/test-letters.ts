/**
 * Motivational letter checks.
 *
 * The property that matters most is negative: for every fact the student did
 * not give, the letter must contain no sentence about it. A generator that
 * writes "I have always been passionate about engineering" for a student who
 * never said so has put words in their mouth, and these tests are what stops
 * that being shipped.
 */
import { ComposedLetter, letterTitle } from '../lib/letters/compose';
import { QUESTIONS, gapsIn } from '../lib/letters/questions';
import { letterFileName, letterToPdf } from '../lib/letters/pdf';
import type { LetterAnswers, LetterFacts, LetterOpportunity } from '../lib/letters/types';

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

const provider = new ComposedLetter();

const fullFacts: LetterFacts = {
  firstName: 'Thandiwe',
  lastName: 'Mokoena',
  qualificationLevel: 'BACHELORS',
  programmeName: 'Electrical Engineering',
  institutionName: 'University of Cape Town',
  yearOfStudy: 2,
  academicAverage: 74,
  householdIncome: 'BELOW_50K',
  province: 'WESTERN_CAPE',
  results: [
    { subjectName: 'Mathematics', percentage: 82, year: 2025 },
    { subjectName: 'Physical Sciences', percentage: 77, year: 2025 },
    { subjectName: 'English Home Language', percentage: 68, year: 2025 },
  ],
  careerInterests: ['Engineering', 'Energy'],
  achievements: ['subject distinctions'],
};

const emptyFacts: LetterFacts = {
  firstName: 'Sipho',
  lastName: 'Dlamini',
  qualificationLevel: null,
  programmeName: null,
  institutionName: null,
  yearOfStudy: null,
  academicAverage: null,
  householdIncome: null,
  province: null,
  results: [],
  careerInterests: [],
  achievements: [],
};

const opportunity: LetterOpportunity = {
  name: 'Engineering Bursary 2026',
  organisationName: 'Eskom Holdings',
  fundingType: 'Bursary',
  coverage: ['Tuition fees', 'Accommodation'],
  fieldsOfStudy: ['Electrical Engineering'],
  subjectRequirements: [{ subjectName: 'Mathematics', minimumPercentage: 70 }],
  minimumAverage: 65,
};

const bareOpportunity: LetterOpportunity = {
  name: 'Some Bursary',
  organisationName: 'Some Trust',
  fundingType: 'Bursary',
  coverage: [],
  fieldsOfStudy: [],
  subjectRequirements: [],
  minimumAverage: null,
};

const answers: LetterAnswers = {
  whyApplying: 'I am applying because Eskom works on the grid problems I want to solve',
  whyThisField: 'Load shedding at home made me want to understand how power systems fail.',
  goals: 'I want to work in grid reliability after I qualify',
  fundingChallenges: 'My mother supports three of us on one income',
  proudestAchievement: 'I tutored matric maths at my old school for two years',
  whySuitable: 'I finish what I start, even when it is slow going.',
  howItHelps: 'It would mean I can study without working night shifts',
};

// --------------------------------------------------------------- facts only
console.log('\nA letter uses only what it was given');
const minimal = provider.compose({ facts: emptyFacts, opportunity: bareOpportunity, answers: {} });
check('names the student', minimal.content.includes('Sipho Dlamini'));
check('names the bursary', minimal.content.includes('Some Bursary'));
check('no invented institution', !/University|College|TVET/i.test(minimal.content));
check('no invented mark', !/\d+%/.test(minimal.content));
check(
  'no invented passion',
  !/passionate|always dreamed|lifelong dream|from a young age/i.test(minimal.content),
);
check('no unfilled placeholder', !/\[|\]|\{|\}|XXX|TBC|Lorem/i.test(minimal.content));
check('uses no answer it was not given', minimal.usedAnswers.length === 0);
check('still signs off', minimal.content.includes('Yours faithfully,'));

// ------------------------------------------------------------ the full case
console.log('\nEvery fact given appears, and is attributed correctly');
const full = provider.compose({ facts: fullFacts, opportunity, answers });
check('institution', full.content.includes('University of Cape Town'));
check('course', full.content.includes('Electrical Engineering'));
check('year of study', full.content.includes('year 2'));
check('average', full.content.includes('74%'));
check('cites the met subject requirement', full.content.includes('Mathematics at 82%'));
check('names the requirement it was measured against', full.content.includes('70%'));
check('addresses the funder', full.content.startsWith('Dear Eskom Holdings'));
check('signs with the student', full.content.trim().endsWith('Thandiwe Mokoena'));
check('uses every answer given', full.usedAnswers.length === Object.keys(answers).length);

console.log("\nThe student's own words are carried through unchanged");
for (const question of QUESTIONS) {
  const written = (answers[question.key] ?? '').replace(/[.]$/, '');
  check(
    `${question.key} appears as written`,
    full.content.includes(written) ||
      full.content.includes(written.charAt(0).toLowerCase() + written.slice(1)),
    written,
  );
}

console.log('\nA fact the student did not give produces no sentence about it');
const noIncome = provider.compose({
  facts: { ...fullFacts, householdIncome: null },
  opportunity,
  answers: { whyApplying: answers.whyApplying },
});
check('no income band', !/R50,000|household income/i.test(noIncome.content));
const noResults = provider.compose({
  facts: { ...fullFacts, results: [], academicAverage: null },
  opportunity,
  answers: {},
});
check('no marks at all', !/\d+%/.test(noResults.content.split('bursary requires')[0]));
check(
  'an unmet requirement is not claimed as met',
  !provider
    .compose({
      facts: {
        ...fullFacts,
        results: [{ subjectName: 'Mathematics', percentage: 61, year: 2025 }],
      },
      opportunity,
      answers: {},
    })
    .content.includes('Mathematics at 61%'),
);

console.log('\nDeterminism');
const again = provider.compose({ facts: fullFacts, opportunity, answers });
check('same input, same letter', again.content === full.content);
check('the generator names itself', provider.name.length > 0);

// ------------------------------------------------------------------- gaps
console.log('\nGaps are reported rather than filled');
const gaps = gapsIn(emptyFacts, {});
check(
  'asks why they are applying',
  gaps.some((gap) => gap.key === 'whyApplying'),
);
check(
  'asks about their goals',
  gaps.some((gap) => gap.key === 'goals'),
);
check(
  'asks for the missing profile',
  gaps.some((gap) => gap.key === 'profile'),
);
check(
  'every gap says why it matters',
  gaps.every((gap) => gap.because.length > 20),
);
check('a complete profile with answers has no gaps', gapsIn(fullFacts, answers).length === 0);
check(
  'a blank answer still counts as missing',
  gapsIn(fullFacts, { whyApplying: '   ', goals: 'x' }).some((gap) => gap.key === 'whyApplying'),
);

// -------------------------------------------------------------------- PDF
async function pdfChecks() {
  console.log('\nThe PDF is a real PDF');
  const bytes = await letterToPdf(full.content);
  const header = Buffer.from(bytes.slice(0, 5)).toString('latin1');
  check('starts with %PDF-', header === '%PDF-');
  check('has real size', bytes.byteLength > 800, `${bytes.byteLength} bytes`);
  const long = await letterToPdf(Array.from({ length: 400 }, () => full.content).join('\n\n'));
  check('a long letter still produces a PDF', long.byteLength > bytes.byteLength);
  const awkward = await letterToPdf('Word'.repeat(200) + '\n\nCurly “quotes” and — dashes.');
  check('unbreakable words and punctuation do not throw', awkward.byteLength > 800);
  check(
    'filename is safe',
    letterFileName('Motivational Letter — Eskom/2026') === 'Motivational-Letter-Eskom2026.pdf',
  );
  check('a nameless letter still gets a filename', letterFileName('***') === 'letter.pdf');
  check(
    'title names the funder',
    letterTitle('Engineering Bursary', 'Eskom') === 'Motivational Letter — Eskom',
  );
}

pdfChecks().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed > 0 ? 1 : 0);
});
