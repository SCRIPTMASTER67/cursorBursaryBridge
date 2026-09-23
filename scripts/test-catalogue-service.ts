/**
 * Catalogue checks, against the real database.
 *
 * The catalogue is shared by study preferences, funder eligibility and
 * matching, so the two properties that matter most are that one real thing
 * cannot become two rows, and that retiring an entry never destroys the
 * records pointing at it.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  activeInstitutionOptions,
  activeProgrammeOptions,
  createInstitution,
  createProgramme,
  listInstitutions,
  listProgrammes,
  programmesAtInstitution,
  setInstitutionStatus,
  setProgrammeStatus,
  updateInstitution,
  updateProgramme,
} from '../services/catalogue';

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
  const created: { institutions: string[]; programmes: string[] } = {
    institutions: [],
    programmes: [],
  };

  try {
    console.log('\nAdding to the catalogue');
    const inst = await createInstitution({
      name: `Test University of ${tag}`,
      shortName: `TU${tag}`,
      type: 'UNIVERSITY',
      province: 'GAUTENG',
      city: 'Pretoria',
      website: 'https://example.test',
      code: `TU-${tag}`,
    });
    check('an institution is created', inst.ok);
    if (inst.ok) created.institutions.push(inst.value.id);

    const course = await createProgramme({
      name: `Test Engineering ${tag}`,
      field: 'ENGINEERING',
      qualificationLevels: ['BACHELORS', 'HONOURS'],
      institutionIds: inst.ok ? [inst.value.id] : [],
    });
    check('a course is created and linked to the institution', course.ok);
    if (course.ok) created.programmes.push(course.value.id);

    console.log('\nOne real thing cannot become two rows');
    const dupe = await createInstitution({
      name: `  test university of ${tag.toUpperCase()}  `,
      type: 'UNIVERSITY',
      province: 'GAUTENG',
      city: 'Pretoria',
    });
    check('a differently-spelled duplicate is refused', !dupe.ok, dupe.ok ? 'it was created' : '');
    check('the refusal names the existing entry', !dupe.ok && /already/i.test(dupe.reason));
    check(
      'the refusal points at the row to use',
      !dupe.ok && dupe.existingId === (inst.ok ? inst.value.id : ''),
    );

    const punct = await createProgramme({
      name: `Test  Engineering, ${tag}!`,
      field: 'ENGINEERING',
      qualificationLevels: ['BACHELORS'],
    });
    check('punctuation and spacing do not make a new course', !punct.ok);

    const empty = await createInstitution({
      name: '   ',
      type: 'UNIVERSITY',
      province: 'GAUTENG',
      city: 'X',
    });
    check('an unusable name is refused', !empty.ok);
    const noLevel = await createProgramme({
      name: `Nothing ${tag}`,
      field: 'ENGINEERING',
      qualificationLevels: [],
    });
    check('a course with no qualification level is refused', !noLevel.ok);

    console.log('\nThe course↔institution relationship is real');
    if (inst.ok) {
      const offered = await programmesAtInstitution(inst.value.id);
      check(
        'the linked course is offered at the institution',
        offered.some((p) => p.id === created.programmes[0]),
      );
      check(
        'only linked courses are returned once links exist',
        offered.length === 1,
        String(offered.length),
      );
    }

    console.log('\nEditing');
    if (inst.ok) {
      const renamed = await updateInstitution(inst.value.id, {
        name: `Renamed University ${tag}`,
        city: 'Johannesburg',
      });
      check('an institution can be renamed', renamed.ok);
      const clash = await updateInstitution(inst.value.id, { name: 'University of Pretoria' });
      check('renaming onto an existing name is refused', !clash.ok, clash.ok ? 'allowed' : '');
    }
    if (course.ok && inst.ok) {
      const relinked = await updateProgramme(course.value.id, { institutionIds: [] });
      check('links can be removed', relinked.ok);
      const after = await programmesAtInstitution(inst.value.id);
      check(
        'removing the last link falls back to every active course',
        after.length > 1,
        String(after.length),
      );
    }

    console.log('\nRetiring keeps the records that point at it');
    if (inst.ok) {
      const before = await db.institution.findUniqueOrThrow({
        where: { id: inst.value.id },
        select: { id: true },
      });
      const retired = await setInstitutionStatus(inst.value.id, 'INACTIVE');
      check('an institution can be retired', retired.value.status === 'INACTIVE');
      const still = await db.institution.findUnique({
        where: { id: before.id },
        select: { id: true },
      });
      check('the row still exists after retiring', still !== null);
      const options = await activeInstitutionOptions();
      check(
        'a retired institution is no longer offered',
        !options.some((o) => o.id === inst.value.id),
      );
      const listed = await listInstitutions({ status: 'ALL', search: tag, pageSize: 50 });
      check(
        'it is still visible to an administrator',
        listed.rows.some((r) => r.id === inst.value.id),
      );
      const restored = await setInstitutionStatus(inst.value.id, 'ACTIVE');
      check('it can be restored', restored.value.status === 'ACTIVE');
    }
    if (course.ok) {
      await setProgrammeStatus(course.value.id, 'INACTIVE');
      const options = await activeProgrammeOptions();
      check(
        'a retired course is no longer offered',
        !options.some((o) => o.id === course.value.id),
      );
      await setProgrammeStatus(course.value.id, 'ACTIVE');
    }

    console.log('\nSearch and filter');
    const found = await listInstitutions({ search: tag, status: 'ALL', pageSize: 50 });
    check('search finds by name', found.rows.length >= 1);
    const byProvince = await listInstitutions({
      province: 'GAUTENG',
      status: 'ALL',
      pageSize: 500,
    });
    check(
      'filtering by province works',
      byProvince.rows.every((r) => r.province === 'GAUTENG'),
    );
    const byField = await listProgrammes({ field: 'ENGINEERING', status: 'ALL', pageSize: 500 });
    check(
      'filtering by field works',
      byField.rows.every((r) => r.field === 'ENGINEERING'),
    );

    console.log('\nThe existing catalogue survived the migration');
    const realInstitutions = await db.institution.count();
    const realCourses = await db.programme.count();
    check('institutions are intact', realInstitutions >= 24, String(realInstitutions));
    check('courses are intact', realCourses >= 38, String(realCourses));
    const missingCanonical = await db.institution.count({ where: { canonicalName: '' } });
    check('every institution has a canonical name', missingCanonical === 0);
  } finally {
    await db.programmeInstitution.deleteMany({
      where: { programmeId: { in: created.programmes } },
    });
    await db.programme.deleteMany({ where: { id: { in: created.programmes } } });
    await db.institution.deleteMany({ where: { id: { in: created.institutions } } });
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
