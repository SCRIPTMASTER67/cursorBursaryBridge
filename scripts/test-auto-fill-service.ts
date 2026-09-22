/**
 * Auto-fill workflow checks, against the real database and real storage.
 *
 * Covers the two things that matter most: that a job runs end to end and
 * produces a downloadable PDF, and that one student cannot reach another
 * student's uploads by id.
 *
 * Usage: `npm run test:autofill` with the database running.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import JSZip from 'jszip';
import { buildSourceForm, buildTargets } from './fixtures/bursary-forms';
import {
  addTargetForms,
  createJob,
  editField,
  getJob,
  getTargetForm,
  processJob,
  renderFilledForm,
  renderJobArchive,
} from '../services/auto-fill';
import { analyseDocument } from '../lib/pdf/extract';
import { storage } from '../lib/storage';

const db = new PrismaClient();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

async function makeStudent(runId: string, tag: string) {
  const user = await db.user.create({
    data: {
      email: `autofill.${tag}.${runId}@example.test`,
      passwordHash: await hash('Test-Password-1', 4),
      role: 'STUDENT',
      firstName: 'Test',
      lastName: tag,
      studentProfile: { create: {} },
    },
    select: { id: true, studentProfile: { select: { id: true } } },
  });
  return { userId: user.id, studentProfileId: user.studentProfile!.id };
}

async function main() {
  const runId = randomBytes(4).toString('hex');
  const owner = await makeStudent(runId, 'owner');
  const intruder = await makeStudent(runId, 'intruder');

  try {
    const sourceBytes = Buffer.from(await buildSourceForm());
    const targets = await buildTargets();

    console.log('\nRunning a job end to end');
    const job = await createJob({
      studentProfileId: owner.studentProfileId,
      userId: owner.userId,
      fileName: 'ikusasa-completed.pdf',
      bytes: sourceBytes,
    });
    check('a job is created in DRAFT', job.status === 'DRAFT');

    const added = await addTargetForms({
      jobId: job.id,
      studentProfileId: owner.studentProfileId,
      files: targets.map((t) => ({ fileName: t.documentName, bytes: Buffer.from(t.bytes) })),
    });
    check('all six blank forms are accepted', added.ok && added.targetForms.length === 6);

    const run = await processJob({
      jobId: job.id,
      studentProfileId: owner.studentProfileId,
      userId: owner.userId,
    });
    check('processing completes', run.ok && run.jobStatus === 'COMPLETED');

    const stored = await getJob(job.id, owner.studentProfileId);
    check('the job is COMPLETED', stored?.status === 'COMPLETED');
    check('the matcher used is recorded', stored?.matcher === 'dictionary-v1');
    check(
      'every form was processed',
      stored?.targetForms.every((f) => f.status === 'COMPLETED') ?? false,
      stored?.targetForms.map((f) => `${f.originalFileName}:${f.status}`).join(', '),
    );
    check(
      'canonical values are stored with their provenance',
      (stored?.extractedValues.length ?? 0) >= 20 &&
        (stored?.extractedValues.every((v) => v.sourceFieldLabel.length > 0) ?? false),
    );
    check(
      'no guardian or referee value became a canonical value',
      !(stored?.extractedValues ?? []).some((v) =>
        ['Thandiwe Mthembu', '7508120123084', '031 555 0198'].includes(v.raw),
      ),
    );

    console.log('\nOwnership');
    check(
      'another student cannot read the job',
      (await getJob(job.id, intruder.studentProfileId)) === null,
    );

    const sizani = stored!.targetForms.find((f) => f.originalFileName.startsWith('sizani'))!;
    check(
      'another student cannot read a target form',
      (await getTargetForm(sizani.id, intruder.studentProfileId)) === null,
    );
    const intruderDownload = await renderFilledForm(sizani.id, intruder.studentProfileId);
    check('another student cannot download a filled form', !intruderDownload.ok);
    const intruderArchive = await renderJobArchive(job.id, intruder.studentProfileId);
    check('another student cannot download the archive', !intruderArchive.ok);

    const detail = await getTargetForm(sizani.id, owner.studentProfileId);
    const surname = detail!.fields.find((f) => f.label === 'Surname')!;
    const intruderEdit = await editField({
      fieldId: surname.id,
      studentProfileId: intruder.studentProfileId,
      userId: intruder.userId,
      value: 'Tampered',
    });
    check('another student cannot edit a field', !intruderEdit.ok);

    console.log('\nEditing and downloading');
    check(
      'the owner sees a reason on every field',
      detail!.fields.every((f) => f.reason.length > 0),
    );
    check(
      'blank fields carry no value',
      detail!.fields.every(
        (f) => (f.status === 'FILLED' || f.status === 'NEEDS_REVIEW') === (f.value !== null),
      ),
    );

    const edited = await editField({
      fieldId: surname.id,
      studentProfileId: owner.studentProfileId,
      userId: owner.userId,
      value: 'Mthembu-Ndlovu',
    });
    check('the owner can edit a field', edited.ok);

    const edits = await db.autoFillFieldEdit.findMany({ where: { fieldId: surname.id } });
    check(
      'the edit is recorded in the audit trail',
      edits.length === 1 && edits[0].previousValue === 'Mthembu',
    );

    const download = await renderFilledForm(sizani.id, owner.studentProfileId);
    check('the filled form downloads', download.ok);
    if (download.ok) {
      check(
        'the download is named after the form',
        download.fileName === 'sizani-education-fund-filled.pdf',
      );
      check(
        'the bytes are a real PDF',
        Buffer.from(download.bytes).subarray(0, 5).toString('latin1') === '%PDF-',
      );
      const reopened = await analyseDocument(download.bytes);
      const value = reopened.fields.find((f) => f.name === 'Surname')?.value;
      check(
        'the download carries the edited value, not the original',
        value === 'Mthembu-Ndlovu',
        String(value),
      );
    }

    const clearedResult = await editField({
      fieldId: surname.id,
      studentProfileId: owner.studentProfileId,
      userId: owner.userId,
      value: '',
    });
    check('clearing a field is allowed', clearedResult.ok && clearedResult.field.value === null);
    const afterClear = await getTargetForm(sizani.id, owner.studentProfileId);
    check(
      'a cleared field reads as missing',
      afterClear!.fields.find((f) => f.id === surname.id)?.status === 'MISSING',
    );
    check(
      'the form counts are updated after an edit',
      afterClear!.fieldsFilled === afterClear!.fields.filter((f) => f.status === 'FILLED').length,
    );

    const archive = await renderJobArchive(job.id, owner.studentProfileId);
    check('the archive builds', archive.ok);
    if (archive.ok) {
      const zip = await JSZip.loadAsync(archive.bytes);
      const names = Object.keys(zip.files);
      check('the archive holds one PDF per completed form', names.length === 6, names.join(', '));
      check(
        'every entry is a PDF',
        names.every((n) => n.endsWith('.pdf')),
      );
    }

    console.log('\nRefusing what cannot be read');
    const notAPdf = await createJob({
      studentProfileId: owner.studentProfileId,
      userId: owner.userId,
      fileName: 'broken.pdf',
      bytes: Buffer.from('this is not a pdf'),
    });
    await addTargetForms({
      jobId: notAPdf.id,
      studentProfileId: owner.studentProfileId,
      files: [{ fileName: 'target.pdf', bytes: Buffer.from(targets[0].bytes) }],
    });
    const brokenRun = await processJob({
      jobId: notAPdf.id,
      studentProfileId: owner.studentProfileId,
      userId: owner.userId,
    });
    check(
      'an unreadable source fails the job, not the request',
      brokenRun.ok && brokenRun.jobStatus === 'FAILED',
    );
    const brokenJob = await getJob(notAPdf.id, owner.studentProfileId);
    check(
      'the student is told why',
      (brokenJob?.failureReason?.length ?? 0) > 0,
      brokenJob?.failureReason ?? '',
    );

    const mixed = await createJob({
      studentProfileId: owner.studentProfileId,
      userId: owner.userId,
      fileName: 'ikusasa-completed.pdf',
      bytes: sourceBytes,
    });
    await addTargetForms({
      jobId: mixed.id,
      studentProfileId: owner.studentProfileId,
      files: [
        { fileName: 'good.pdf', bytes: Buffer.from(targets[0].bytes) },
        { fileName: 'damaged.pdf', bytes: Buffer.from('%PDF-1.4 truncated') },
      ],
    });
    await processJob({
      jobId: mixed.id,
      studentProfileId: owner.studentProfileId,
      userId: owner.userId,
    });
    const mixedJob = await getJob(mixed.id, owner.studentProfileId);
    const good = mixedJob?.targetForms.find((f) => f.originalFileName === 'good.pdf');
    const damaged = mixedJob?.targetForms.find((f) => f.originalFileName === 'damaged.pdf');
    check('one damaged form does not fail the batch', good?.status === 'COMPLETED');
    check(
      'the damaged form is reported on its own',
      damaged?.status === 'FAILED' && (damaged.failureReason?.length ?? 0) > 0,
    );
    check('the job still completes', mixedJob?.status === 'COMPLETED');
  } finally {
    // Remove the stored PDFs as well as the rows, so a test run leaves nothing
    // behind on disk.
    const jobs = await db.autoFillJob.findMany({
      where: { studentProfileId: { in: [owner.studentProfileId, intruder.studentProfileId] } },
      select: { sourceStorageKey: true, targetForms: { select: { originalStorageKey: true } } },
    });
    for (const job of jobs) {
      await storage().delete(job.sourceStorageKey);
      for (const form of job.targetForms) await storage().delete(form.originalStorageKey);
    }
    await db.user.deleteMany({ where: { email: { contains: runId } } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
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
