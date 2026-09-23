/**
 * Subject results, against the real database.
 *
 * The point of these results is that the matching engine reads them, so the
 * checks run all the way through: enter a mark, then ask the matching engine
 * what it now says about a bursary that requires that subject.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  addResult,
  deleteResult,
  levelForStage,
  listResults,
  reorderResults,
  subjectOptions,
  updateResult,
  vocabularyForStage,
} from '../services/student-results';
import { loadMatchableStudent } from '../services/matching';
import { MatchingService } from '../lib/matching/engine';
import { toMatchableProgramme } from '../lib/matching/adapters';
import { canonicalise } from '../lib/catalogue';

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
  let profileId = '';
  let orgId = '';
  let programmeId = '';

  try {
    const user = await db.user.create({
      data: {
        email: `results.${tag}@example.test`,
        passwordHash: 'x',
        role: 'STUDENT',
        firstName: 'Results',
        lastName: 'Tester',
        studentProfile: {
          create: {
            onboardingCompletedAt: new Date(),
            educationStage: 'MATRIC',
            qualificationLevel: 'BACHELORS',
            academicAverage: 72,
            province: 'GAUTENG',
            citizenship: 'SA_CITIZEN',
            yearOfStudy: 1,
          },
        },
      },
      select: { id: true, studentProfile: { select: { id: true } } },
    });
    profileId = user.studentProfile!.id;

    console.log('\nThe screen speaks the student’s own language');
    check('a matric learner has subjects', vocabularyForStage('MATRIC').singular === 'subject');
    check(
      'a university student has modules',
      vocabularyForStage('UNIVERSITY_CURRENT').singular === 'module',
    );
    check('school stage maps to SCHOOL', levelForStage('MATRIC') === 'SCHOOL');
    check('university stage maps to TERTIARY', levelForStage('UNIVERSITY_CURRENT') === 'TERTIARY');

    console.log('\nThe subject catalogue is real');
    const options = await subjectOptions('SCHOOL');
    check(
      'National Senior Certificate subjects are available',
      options.length >= 30,
      String(options.length),
    );
    const maths = options.find((s) => s.name === 'Mathematics');
    const science = options.find((s) => s.name === 'Physical Sciences');
    check('Mathematics is in the catalogue', Boolean(maths));
    check('Physical Sciences is in the catalogue', Boolean(science));

    console.log('\nTEST C — adding results');
    const added = await addResult(profileId, {
      subjectId: maths!.id,
      percentage: 78,
      year: 2026,
      level: 'SCHOOL',
    });
    check('Mathematics = 78% is added', added.ok);
    const added2 = await addResult(profileId, {
      subjectId: science!.id,
      percentage: 74,
      year: 2026,
      level: 'SCHOOL',
    });
    check('Physical Sciences = 74% is added', added2.ok);

    const stored = await listResults(profileId);
    check('both are stored', stored.length === 2, String(stored.length));
    check(
      'the marks are stored exactly',
      stored
        .map((r) => r.percentage)
        .sort()
        .join(',') === '74,78',
    );

    console.log('\nA mark you do not have is not a zero');
    const noMark = await addResult(profileId, {
      subjectName: `Advanced Programming ${tag}`,
      percentage: null,
      year: 2026,
      level: 'SCHOOL',
    });
    check('a subject can be entered without a mark', noMark.ok);
    const withNull = await listResults(profileId);
    const blank = withNull.find((r) => r.subject.name.includes(tag));
    check('it is stored as no result, not as 0', blank?.percentage === null);

    console.log('\nA subject you type is kept and marked as yours');
    check('it became a custom catalogue entry', blank?.subject.custom === true);
    const reused = await addResult(profileId, {
      subjectName: `  advanced   programming ${tag.toUpperCase()}  `,
      percentage: 66,
      year: 2025,
      level: 'SCHOOL',
    });
    check('a differently-spelled version reuses the same entry', reused.ok);
    const afterReuse = await listResults(profileId);
    const sameSubject = afterReuse.filter((r) =>
      r.subject.name.toLowerCase().includes(tag.toLowerCase()),
    );
    check(
      '...rather than creating a second subject',
      new Set(sameSubject.map((r) => r.subject.id)).size === 1,
    );

    console.log('\nValidation');
    const dupe = await addResult(profileId, {
      subjectId: maths!.id,
      percentage: 80,
      year: 2026,
      level: 'SCHOOL',
    });
    check('the same subject and year twice is refused', !dupe.ok);
    const tooHigh = await addResult(profileId, {
      subjectId: science!.id,
      percentage: 140,
      year: 2025,
      level: 'SCHOOL',
    });
    check('a mark above 100 is refused', !tooHigh.ok);
    const badYear = await addResult(profileId, {
      subjectId: science!.id,
      percentage: 50,
      year: 1890,
      level: 'SCHOOL',
    });
    check('an impossible year is refused', !badYear.ok);
    const noSubject = await addResult(profileId, {
      subjectName: '  ',
      year: 2026,
      level: 'SCHOOL',
    });
    check('an empty subject name is refused', !noSubject.ok);

    console.log('\nEdit, reorder and delete');
    const rows = await listResults(profileId);
    const edited = await updateResult(profileId, rows[0].id, {
      percentage: 81,
      year: rows[0].year,
      level: 'SCHOOL',
    });
    check('a result can be edited', edited.ok);
    const reordered = await reorderResults(
      profileId,
      [...rows].reverse().map((r) => r.id),
    );
    check('results can be reordered', reordered.ok);
    const afterOrder = await listResults(profileId);
    check('the order is saved', afterOrder[0].id === rows[rows.length - 1].id);
    const notMine = await reorderResults(profileId, ['not-a-real-id']);
    check('reordering somebody else’s result is refused', !notMine.ok);

    console.log('\nTEST C — the matching engine actually uses them');
    const org = await db.organisation.create({
      data: { name: `Results Test Funder ${tag}`, type: 'CORPORATION', industry: 'OTHER' },
      select: { id: true },
    });
    orgId = org.id;

    const programme = await db.fundingProgramme.create({
      data: {
        organisationId: orgId,
        name: `Maths Bursary ${tag}`,
        slug: `maths-bursary-${tag}`,
        shortDescription: 'Test',
        fullDescription: 'Test',
        fundingType: 'BURSARY',
        coverage: [],
        status: 'PUBLISHED',
        origin: 'FIRST_PARTY',
        availability: 'OPEN',
        openDate: new Date(Date.now() - 86_400_000),
        closingDate: new Date(Date.now() + 86_400_000 * 30),
        eligibility: {
          create: {
            subjectRequirements: { create: [{ subjectId: maths!.id, minimumPercentage: 70 }] },
          },
        },
      },
      select: { id: true },
    });
    programmeId = programme.id;

    const loaded = await db.fundingProgramme.findUniqueOrThrow({
      where: { id: programmeId },
      select: {
        id: true,
        supportedProgrammes: { select: { programmeId: true } },
        supportedInstitutions: { select: { institutionId: true } },
        eligibility: {
          include: { subjectRequirements: { include: { subject: { select: { name: true } } } } },
        },
      },
    });

    const student = await loadMatchableStudent(profileId);
    check(
      'the loader carries the subject results',
      (student?.subjectResults.length ?? 0) >= 3,
      String(student?.subjectResults.length),
    );

    const result = MatchingService.score(student!, toMatchableProgramme(loaded));
    const subjects = result.criteria.find((c) => c.key === 'subjects')!;
    check('the subjects criterion is evaluated', Boolean(subjects));
    check(
      'an 81% Mathematics result meets a 70% requirement',
      subjects.status === 'MET',
      subjects.reason,
    );
    check(
      '...and the explanation names both numbers',
      /Mathematics result of 81%.*minimum Mathematics requirement of 70%/.test(subjects.reason),
      subjects.reason,
    );

    // Drop below the requirement and confirm the engine changes its mind.
    const mathsRow = (await listResults(profileId)).find((r) => r.subject.name === 'Mathematics')!;
    await updateResult(profileId, mathsRow.id, {
      percentage: 61,
      year: mathsRow.year,
      level: 'SCHOOL',
    });
    const lower = MatchingService.score(
      (await loadMatchableStudent(profileId))!,
      toMatchableProgramme(loaded),
    );
    const lowerSubjects = lower.criteria.find((c) => c.key === 'subjects')!;
    check(
      'a 61% result does not meet a 70% requirement',
      lowerSubjects.status === 'NOT_MET',
      lowerSubjects.reason,
    );
    check(
      '...and the score falls',
      lower.matchScore < result.matchScore,
      `${lower.matchScore} vs ${result.matchScore}`,
    );

    // Remove it entirely: unknown, never a failure.
    await deleteResult(profileId, mathsRow.id);
    const removed = MatchingService.score(
      (await loadMatchableStudent(profileId))!,
      toMatchableProgramme(loaded),
    );
    const removedSubjects = removed.criteria.find((c) => c.key === 'subjects')!;
    check(
      'with no Mathematics result the requirement is UNKNOWN',
      removedSubjects.status === 'UNKNOWN',
    );
    check(
      '...and the student is asked for it rather than rejected',
      /add your mathematics result/i.test(removedSubjects.reason),
      removedSubjects.reason,
    );
  } finally {
    await db.fundingProgramme.deleteMany({ where: { id: programmeId } });
    await db.organisation.deleteMany({ where: { id: orgId } });
    await db.user.deleteMany({ where: { email: { contains: tag } } });
    await db.subjectCatalogue.deleteMany({
      where: { canonicalName: { contains: canonicalise(tag) } },
    });
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
