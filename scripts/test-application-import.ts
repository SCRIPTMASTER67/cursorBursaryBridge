/**
 * Bulk application intake, end to end against the real database.
 *
 * The property that matters is that the work is actually done: a real PDF goes
 * in, and what comes out is a scored, eligibility-checked applicant record
 * whose fields can be traced back to labels on the form. So this drives the
 * real service — the real extractor, the real matching engine, the real
 * storage — rather than stubbing any of it.
 *
 * The negative checks matter as much: an unreadable file must be kept with a
 * reason rather than dropped, a duplicate must be flagged rather than deleted,
 * and an applicant who cannot be identified must get their own record rather
 * than being attached to somebody else's account.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import JSZip from 'jszip';
import { PrismaClient } from '@prisma/client';
import { buildSourceForm } from './fixtures/bursary-forms';
import {
  batchFiles,
  confirmImport,
  createBatch,
  getBatch,
  listBatches,
  processBatch,
} from '../services/application-import';
import { classifyDocument, expandUpload } from '../lib/import/bundle';
import { compareApplicants, normaliseIdNumber, resolveIdentity } from '../lib/import/identity';

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
  let institutionId = '';
  let courseId = '';

  try {
    // ------------------------------------------------- pure units first
    console.log('\nFile names are classified from what the organisation called them');
    check('an ID copy', classifyDocument('Thabo_ID_copy.pdf') === 'ID_DOCUMENT');
    check('a transcript', classifyDocument('academic-record-2026.pdf') === 'TRANSCRIPT');
    check(
      'proof of registration',
      classifyDocument('Proof of Registration.pdf') === 'PROOF_OF_REGISTRATION',
    );
    check('a payslip', classifyDocument('mother payslip march.pdf') === 'PROOF_OF_INCOME');
    check('something unlabelled', classifyDocument('scan0001.pdf') === 'OTHER');

    console.log('\nIdentity is decided on identifiers, never on a name');
    check(
      'ID numbers are compared as digits',
      normaliseIdNumber('030412 5678 083') === '0304125678083',
    );
    check('a short number is not an identifier', normaliseIdNumber('1234') === null);
    check(
      'the same ID is a strong duplicate',
      compareApplicants(
        {
          idNumber: '0304125678083',
          email: null,
          fullName: 'A B',
          dateOfBirth: null,
          mobile: null,
        },
        {
          idNumber: '030412-5678-083',
          email: null,
          fullName: 'C D',
          dateOfBirth: null,
          mobile: null,
        },
      ).duplicate,
    );
    const differentIds = compareApplicants(
      {
        idNumber: '0304125678083',
        email: 'x@y.z',
        fullName: 'Same Name',
        dateOfBirth: null,
        mobile: null,
      },
      {
        idNumber: '9911225678083',
        email: 'x@y.z',
        fullName: 'Same Name',
        dateOfBirth: null,
        mobile: null,
      },
    );
    check('two different ID numbers settle it, whatever else matches', !differentIds.duplicate);
    const nameOnly = compareApplicants(
      { idNumber: null, email: null, fullName: 'Thabo Nkosi', dateOfBirth: null, mobile: null },
      { idNumber: null, email: null, fullName: 'thabo nkosi', dateOfBirth: null, mobile: null },
    );
    check(
      'a name alone is only ever "possible"',
      nameOnly.duplicate && nameOnly.strength === 'possible',
    );

    const ambiguous = await resolveIdentity(
      {
        idNumber: null,
        email: 'shared@example.test',
        fullName: null,
        dateOfBirth: null,
        mobile: null,
      },
      { byIdNumber: async () => [], byEmail: async () => ['a', 'b'] },
    );
    check(
      'two accounts matching is AMBIGUOUS, not a coin toss',
      ambiguous.resolution === 'AMBIGUOUS',
    );

    console.log('\nAn upload is expanded without losing anything');
    const form = await buildSourceForm();
    const zip = new JSZip();
    zip.folder('Applicant One')!.file('Application Form.pdf', form);
    zip.folder('Applicant One')!.file('ID copy.pdf', form);
    zip.file('__MACOSX/._junk', 'noise');
    zip.folder('Empty Folder')!.file('notes.txt', 'nothing here');
    const zipBytes = await zip.generateAsync({ type: 'uint8array' });

    const expanded = await expandUpload([
      { fileName: 'batch.zip', bytes: zipBytes },
      { fileName: 'loose.pdf', bytes: form },
      { fileName: 'notes.txt', bytes: new TextEncoder().encode('hello') },
    ]);
    check(
      'a folder becomes one application',
      expanded.entries.some((e) => e.fileName === 'Application Form.pdf'),
    );
    check(
      'its other files become supporting documents',
      expanded.entries.find((e) => e.fileName === 'Application Form.pdf')?.documents.length === 1,
    );
    check(
      'a loose PDF is its own application',
      expanded.entries.some((e) => e.fileName === 'loose.pdf'),
    );
    check('archive noise is ignored', !expanded.entries.some((e) => e.fileName.startsWith('._')));
    check(
      'a non-PDF is refused with a reason',
      expanded.rejected.some((r) => r.fileName === 'notes.txt'),
    );
    check(
      'a folder with no PDF is reported rather than dropped',
      expanded.rejected.some((r) => r.fileName.includes('Empty Folder')),
    );

    // ------------------------------------------------- the real pipeline
    const institution = await db.institution
      .create({
        data: {
          name: 'University of Zululand',
          canonicalName: 'university of zululand',
          type: 'UNIVERSITY',
          province: 'KWAZULU_NATAL',
          city: 'Richards Bay',
        },
        select: { id: true },
      })
      .catch(async () =>
        db.institution.findFirstOrThrow({
          where: { canonicalName: 'university of zululand' },
          select: { id: true },
        }),
      );
    institutionId = institution.id;

    const course = await db.programme
      .create({
        data: {
          name: 'Bachelor of Science in Computer Science',
          canonicalName: 'bachelor of science in computer science',
          field: 'TECHNOLOGY',
        },
        select: { id: true },
      })
      .catch(async () =>
        db.programme.findFirstOrThrow({
          where: { canonicalName: 'bachelor of science in computer science' },
          select: { id: true },
        }),
      );
    courseId = course.id;

    const org = await db.organisation.create({
      data: { name: `Import Funder ${tag}`, type: 'CORPORATION', industry: 'TECHNOLOGY' },
      select: { id: true },
    });
    orgId = org.id;

    const reviewer = await db.user.create({
      data: {
        email: `import.reviewer.${tag}@example.test`,
        passwordHash: 'x',
        role: 'CORPORATE',
        firstName: 'Imp',
        lastName: 'Orter',
        corporateProfile: { create: { organisationId: orgId, role: 'OTHER' } },
      },
      select: { id: true },
    });

    const programme = await db.fundingProgramme.create({
      data: {
        organisationId: orgId,
        name: `Import Bursary ${tag}`,
        slug: `import-bursary-${tag}`,
        shortDescription: 'x',
        fullDescription: 'x',
        fundingType: 'BURSARY',
        coverage: ['TUITION_FEES'],
        status: 'PUBLISHED',
        availability: 'OPEN',
        supportedProgrammes: { create: [{ programmeId: courseId }] },
        supportedInstitutions: { create: [{ institutionId }] },
        eligibility: {
          create: { minAcademicAverage: 65, requiredDocuments: ['ID_DOCUMENT', 'TRANSCRIPT'] },
        },
      },
      select: { id: true },
    });
    programmeId = programme.id;

    console.log('\nA batch is stored before anything is read');
    const damaged = new TextEncoder().encode('%PDF-1.4 this is not really a pdf');
    const created = await createBatch({
      organisationId: orgId,
      fundingProgrammeId: programmeId,
      userId: reviewer.id,
      uploads: [
        { fileName: 'application-one.pdf', bytes: form },
        { fileName: 'application-two.pdf', bytes: form },
        { fileName: 'damaged.pdf', bytes: damaged },
        { fileName: 'spreadsheet.xlsx', bytes: new TextEncoder().encode('nope') },
      ],
    });
    check('the batch is created', created.ok);
    if (!created.ok) throw new Error('cannot continue');
    check('it is referenced for the history', created.reference.startsWith('Batch #'));

    const beforeProcessing = await getBatch(created.batchId, orgId);
    check(
      'every uploaded file is accounted for',
      beforeProcessing?.totalFiles === 4,
      String(beforeProcessing?.totalFiles),
    );
    check(
      'an unsupported file is already marked failed',
      (beforeProcessing?.failedCount ?? 0) >= 1,
    );

    console.log('\nProcessing does the work');
    const processed = await processBatch(created.batchId);
    check('the batch processes', processed.ok);

    const after = await getBatch(created.batchId, orgId);
    check('it is ready for review', after?.status === 'READY_FOR_REVIEW');
    check(
      'every file reached a conclusion',
      after?.processedFiles === after?.totalFiles,
      `${after?.processedFiles}/${after?.totalFiles}`,
    );

    const files = await batchFiles(created.batchId, orgId);
    const first = files.find((f) => f.fileName === 'application-one.pdf');
    check(
      'the first form was read',
      Boolean(first) && first!.status !== 'FAILED',
      first?.failureReason ?? '',
    );
    check(
      'fields were extracted from it',
      (first?.fields.length ?? 0) > 5,
      String(first?.fields.length),
    );

    const byKey = new Map(first!.fields.map((f) => [f.canonicalKey, f]));
    check(
      'the applicant name came off the form',
      byKey.get('firstName')?.value === 'Nomvula Precious',
    );
    check(
      'the institution came off the form',
      (byKey.get('institution')?.value ?? '').includes('Zululand'),
    );
    check(
      'every field records what it was read from',
      first!.fields.every((f) => f.sourceFieldLabel.length > 0 || f.method === 'file-name'),
    );
    check(
      'every field carries a confidence',
      first!.fields.every((f) => ['HIGH', 'MEDIUM', 'LOW'].includes(f.confidence)),
    );

    check(
      'it was scored against this programme',
      first!.matchScore !== null || first!.eligibilityOutcome === 'NOT_ELIGIBLE',
    );
    check('eligibility was decided separately from the score', first!.eligibilityOutcome !== null);
    check('the programme required documents are counted', first!.documentsRequired === 2);

    const second = files.find((f) => f.fileName === 'application-two.pdf');
    check(
      'the identical second form is flagged as a duplicate',
      second?.status === 'DUPLICATE',
      second?.status,
    );
    check(
      'and says why',
      (second?.duplicateReason ?? '').length > 10,
      second?.duplicateReason ?? '',
    );
    check('and is not deleted', second !== undefined);

    const broken = files.find((f) => f.fileName === 'damaged.pdf');
    check('an unreadable file is kept', broken !== undefined);
    check(
      'with a reason a person can act on',
      (broken?.failureReason ?? '').length > 10,
      broken?.failureReason ?? '',
    );

    console.log('\nNothing exists as an application until a person confirms');
    const before = await db.application.count({ where: { fundingProgrammeId: programmeId } });
    check('no applications yet', before === 0, String(before));

    const confirmed = await confirmImport(created.batchId, orgId, reviewer.id, [
      { fileId: first!.id, action: 'IMPORT' },
      { fileId: second!.id, action: 'DISCARD' },
    ]);
    check('the import runs', confirmed.ok);
    check(
      'one application was created',
      confirmed.ok && confirmed.imported === 1,
      JSON.stringify(confirmed),
    );
    check('the duplicate was discarded, not imported', confirmed.ok && confirmed.discarded === 1);

    const applications = await db.application.findMany({
      where: { fundingProgrammeId: programmeId },
      include: { externalApplicant: true },
    });
    check('exactly one application exists', applications.length === 1, String(applications.length));
    const application = applications[0];
    check('it is marked as externally imported', application.source === 'EXTERNAL');
    check('it has no student profile', application.studentProfileId === null);
    check('it has an external applicant', application.externalApplicantId !== null);
    check(
      'the applicant is named from the form',
      application.externalApplicant?.fullName.includes('Nomvula') ?? false,
    );
    check(
      'their institution was resolved to the catalogue',
      application.externalApplicant?.institutionId === institutionId,
    );
    check(
      'their course was resolved to the catalogue',
      application.externalApplicant?.programmeId === courseId,
    );
    check('their average came off the form', application.externalApplicant?.academicAverage === 72);
    check('it enters the pipeline as submitted', application.status === 'SUBMITTED');
    check(
      'the score is carried onto the application',
      application.matchScore !== null || application.eligibilityOutcome === 'NOT_ELIGIBLE',
    );

    const importedFile = await db.applicationImportFile.findFirst({
      where: { applicationId: application.id },
    });
    check('the original document is still linked to it', importedFile !== null);
    check('and still on file', (importedFile?.storageKey ?? '').length > 0);

    console.log('\nThe batch appears in the import history');
    const history = await listBatches(orgId);
    check(
      'the batch is listed',
      history.some((b) => b.id === created.batchId),
    );
    check(
      'with its programme',
      history[0]?.fundingProgramme.name.includes('Import Bursary') ?? false,
    );
    check('and who ran it', history[0]?.createdBy?.firstName === 'Imp');

    console.log('\nOne organisation cannot read another’s import');
    check(
      'a foreign organisation gets nothing',
      (await getBatch(created.batchId, 'another-org')) === null,
    );
    check('nor its files', (await batchFiles(created.batchId, 'another-org')).length === 0);
  } finally {
    await db.applicationImportBatch.deleteMany({ where: { organisationId: orgId } });
    await db.application.deleteMany({ where: { organisationId: orgId } });
    await db.externalApplicant.deleteMany({ where: { organisationId: orgId } });
    await db.fundingProgramme.deleteMany({ where: { id: programmeId } });
    await db.organisation.deleteMany({ where: { id: orgId } });
    await db.user.deleteMany({ where: { email: { contains: tag } } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  await db.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
