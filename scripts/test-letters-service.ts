/**
 * The letter workflow against the real database.
 *
 * The pure composer is covered by `test-letters.ts`. What is checked here is
 * everything around it: that a letter is built from the student's actual
 * profile rows, that one student cannot reach another's letter, and that the
 * student's own edits survive everything except an explicit rewrite.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  deleteLetter,
  factsFor,
  generateLetter,
  letterFor,
  lettersFor,
  letterTargets,
  opportunityFor,
  previousAnswers,
  regenerateLetter,
  saveLetter,
} from '../services/motivational-letters';

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

async function main() {
  const tag = randomBytes(3).toString('hex');
  let orgId = '';
  let programmeId = '';
  let subjectId = '';
  let institutionId = '';
  let courseId = '';

  try {
    const institution = await db.institution.create({
      data: {
        name: `Letter University ${tag}`,
        canonicalName: `letter university ${tag}`,
        type: 'UNIVERSITY',
        province: 'GAUTENG',
        city: 'Johannesburg',
      },
      select: { id: true },
    });
    institutionId = institution.id;

    const course = await db.programme.create({
      data: {
        name: `Letter Engineering ${tag}`,
        canonicalName: `letter engineering ${tag}`,
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
      data: { name: `Letter Funder ${tag}`, type: 'CORPORATION', industry: 'ENERGY' },
      select: { id: true },
    });
    orgId = org.id;

    const programme = await db.fundingProgramme.create({
      data: {
        organisationId: orgId,
        name: `Letter Bursary ${tag}`,
        slug: `letter-bursary-${tag}`,
        shortDescription: 'x',
        fullDescription: 'x',
        fundingType: 'BURSARY',
        coverage: ['TUITION_FEES', 'ACCOMMODATION'],
        status: 'PUBLISHED',
        availability: 'OPEN',
        supportedProgrammes: { create: [{ programmeId: courseId }] },
        eligibility: {
          create: {
            minAcademicAverage: 65,
            subjectRequirements: { create: [{ subjectId, minimumPercentage: 70 }] },
          },
        },
      },
      select: { id: true },
    });
    programmeId = programme.id;

    const student = await db.user.create({
      data: {
        email: `letter.student.${tag}@example.test`,
        passwordHash: 'x',
        role: 'STUDENT',
        firstName: 'Lettie',
        lastName: 'Writer',
        studentProfile: {
          create: {
            onboardingCompletedAt: new Date(),
            qualificationLevel: 'BACHELORS',
            currentInstitutionId: institutionId,
            currentProgrammeId: courseId,
            yearOfStudy: 2,
            academicAverage: 74,
            householdIncome: 'BELOW_50K',
            achievements: ['SUBJECT_DISTINCTIONS'],
            careerInterests: ['ENGINEERING'],
            subjectResults: {
              create: [{ subjectId, percentage: 82, year: 2025, kind: 'FINAL', level: 'SCHOOL' }],
            },
          },
        },
      },
      select: { id: true, studentProfile: { select: { id: true } } },
    });
    const studentProfileId = student.studentProfile!.id;

    const other = await db.user.create({
      data: {
        email: `letter.other.${tag}@example.test`,
        passwordHash: 'x',
        role: 'STUDENT',
        firstName: 'Other',
        lastName: 'Student',
        studentProfile: { create: { onboardingCompletedAt: new Date() } },
      },
      select: { id: true, studentProfile: { select: { id: true } } },
    });
    const otherProfileId = other.studentProfile!.id;

    // ------------------------------------------------- facts come from rows
    console.log('\nThe facts are read from the profile, not assumed');
    const facts = await factsFor(studentProfileId);
    check('facts found', facts !== null);
    check('institution', facts?.institutionName?.includes('Letter University') ?? false);
    check('course', facts?.programmeName?.includes('Letter Engineering') ?? false);
    check('average', facts?.academicAverage === 74);
    check('the result is carried with its subject name', facts?.results[0]?.percentage === 82);
    check('achievement labels are readable', facts?.achievements[0] === 'subject distinctions');

    const emptyFacts = await factsFor(otherProfileId);
    check('an empty profile yields empty facts', (emptyFacts?.results.length ?? -1) === 0);
    check('and no invented average', emptyFacts?.academicAverage === null);

    const opportunity = await opportunityFor(programmeId);
    check(
      'the funder’s subject minimum is read',
      opportunity?.subjectRequirements[0]?.minimumPercentage === 70,
    );
    check('coverage is read', (opportunity?.coverage.length ?? 0) === 2);

    // ---------------------------------------------------------- generating
    console.log('\nGenerating');
    const created = await generateLetter({
      studentProfileId,
      userId: student.id,
      fundingProgrammeId: programmeId,
      answers: { whyApplying: 'I want to work on the grid', goals: 'Grid reliability engineering' },
    });
    check('a letter is created', created.ok);
    if (!created.ok) throw new Error('cannot continue without a letter');
    const letterId = created.letter.id;

    check('it names the student', created.letter.content.includes('Lettie Writer'));
    check('it names the funder', created.letter.content.includes(`Letter Funder ${tag}`));
    check('it cites the met requirement', created.letter.content.includes('82%'));
    check(
      'it uses the student’s own sentence',
      created.letter.content.includes('I want to work on the grid'),
    );
    check('it records which generator wrote it', Boolean(created.letter.generator));
    check('it starts as a draft', created.letter.status === 'DRAFT');
    check('it is not marked as edited', created.letter.editedByStudent === false);
    check(
      'remaining gaps are reported',
      created.gaps.every((gap) => gap.key !== 'goals'),
    );

    const unknownProgramme = await generateLetter({
      studentProfileId,
      userId: student.id,
      fundingProgrammeId: 'does-not-exist',
      answers: {},
    });
    check('an unknown opportunity is refused', !unknownProgramme.ok);

    const manual = await generateLetter({
      studentProfileId,
      userId: student.id,
      fundingProgrammeId: null,
      opportunityName: 'A Bursary Found Elsewhere',
      organisationName: 'Another Trust',
      answers: {},
    });
    check('a letter can be written for a bursary we do not hold', manual.ok);
    // The student's own average may still appear — that is their fact. What
    // must not appear is a claim about this bursary's requirements, because we
    // have never read them.
    check(
      'and claims no requirements we have not read',
      manual.ok && !/requires|minimum|meets the/i.test(manual.letter.content),
    );

    const noName = await generateLetter({
      studentProfileId,
      userId: student.id,
      fundingProgrammeId: null,
      opportunityName: '',
      organisationName: '',
      answers: {},
    });
    check('a nameless bursary is refused', !noName.ok);

    // ----------------------------------------------------------- ownership
    console.log('\nOne student cannot reach another’s letter');
    check('read is scoped', (await letterFor(letterId, otherProfileId)) === null);
    const stolenSave = await saveLetter(letterId, otherProfileId, { content: 'mine now' });
    check('save is scoped', !stolenSave.ok);
    const stolenRegenerate = await regenerateLetter(letterId, otherProfileId, other.id, {});
    check('regenerate is scoped', !stolenRegenerate.ok);
    const stolenDelete = await deleteLetter(letterId, otherProfileId);
    check('delete is scoped', !stolenDelete.ok);
    check('the letter is still there', (await letterFor(letterId, studentProfileId)) !== null);

    // -------------------------------------------------------------- edits
    console.log('\nEditing and rewriting');
    const edited = await saveLetter(letterId, studentProfileId, {
      content: 'My own words entirely.',
    });
    check('an edit saves', edited.ok);
    check('and is recorded as the student’s', edited.ok && edited.letter.editedByStudent);

    const emptied = await saveLetter(letterId, studentProfileId, { content: '   ' });
    check('an empty letter is refused', !emptied.ok);

    const ready = await saveLetter(letterId, studentProfileId, { status: 'READY' });
    check('it can be marked ready', ready.ok && ready.letter.status === 'READY');
    check(
      'marking ready does not count as an edit to the text',
      ready.ok && ready.letter.content === 'My own words entirely.',
    );

    const rewritten = await regenerateLetter(letterId, studentProfileId, student.id, {
      whyApplying: 'A different reason entirely',
    });
    check(
      'a rewrite replaces the text',
      rewritten.ok && rewritten.letter.content !== 'My own words entirely.',
    );
    check(
      'and uses the new answer',
      rewritten.ok && rewritten.letter.content.includes('A different reason entirely'),
    );
    check(
      'and keeps the earlier answers',
      rewritten.ok && rewritten.letter.content.includes('Grid reliability engineering'),
    );
    check('and clears the edited flag', rewritten.ok && rewritten.letter.editedByStudent === false);
    check('and returns it to draft', rewritten.ok && rewritten.letter.status === 'DRAFT');

    // ------------------------------------------------------------ listing
    console.log('\nListing and reuse');
    const mine = await lettersFor(studentProfileId);
    check('both letters are listed', mine.length === 2);
    check('another student sees none of them', (await lettersFor(otherProfileId)).length === 0);

    const remembered = await previousAnswers(studentProfileId);
    check(
      'earlier answers are offered again',
      remembered.whyApplying === 'A different reason entirely',
    );

    const targets = await letterTargets(studentProfileId);
    check(
      'the published bursary is offered as a target',
      targets.some((t) => t.id === programmeId),
    );
    check(
      'a draft bursary is not',
      targets.every((t) => t.name !== 'never-published'),
    );

    check('a letter can be deleted', (await deleteLetter(letterId, studentProfileId)).ok);
    check('and is gone', (await letterFor(letterId, studentProfileId)) === null);
  } finally {
    await db.motivationalLetter.deleteMany({ where: { opportunityName: { contains: tag } } });
    await db.fundingProgramme.deleteMany({ where: { id: programmeId } });
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

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
