/**
 * The Request Information workflow, end to end, against the real database.
 *
 * This replaced a modal that only changed a status, so the checks follow the
 * whole loop the brief describes: a funder asks for specific things, the
 * student sees exactly what was asked, attaches documents, submits, and the
 * funder sees the response.
 */
import '../lib/load-env';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  attachDocument,
  cancelRequest,
  createRequest,
  detachDocument,
  openRequestsForStudent,
  requestForStudent,
  requestsForApplication,
  submitResponse,
} from '../services/information-requests';

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

  try {
    const org = await db.organisation.create({
      data: { name: `Request Funder ${tag}`, type: 'CORPORATION', industry: 'OTHER' },
      select: { id: true },
    });
    orgId = org.id;

    const reviewer = await db.user.create({
      data: {
        email: `reviewer.${tag}@example.test`,
        passwordHash: 'x',
        role: 'CORPORATE',
        firstName: 'Rev',
        lastName: 'Iewer',
        corporateProfile: { create: { organisationId: orgId, role: 'OTHER' } },
      },
      select: { id: true },
    });

    const student = await db.user.create({
      data: {
        email: `applicant.${tag}@example.test`,
        passwordHash: 'x',
        role: 'STUDENT',
        firstName: 'App',
        lastName: 'Licant',
        studentProfile: { create: { onboardingCompletedAt: new Date() } },
      },
      select: { id: true, studentProfile: { select: { id: true } } },
    });
    const studentProfileId = student.studentProfile!.id;

    const programme = await db.fundingProgramme.create({
      data: {
        organisationId: orgId,
        name: `Request Bursary ${tag}`,
        slug: `request-bursary-${tag}`,
        shortDescription: 'x',
        fullDescription: 'x',
        fundingType: 'BURSARY',
        coverage: [],
        status: 'PUBLISHED',
        availability: 'OPEN',
      },
      select: { id: true },
    });
    programmeId = programme.id;

    const application = await db.application.create({
      data: {
        studentProfileId,
        organisationId: orgId,
        fundingProgrammeId: programmeId,
        status: 'UNDER_REVIEW',
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    const doc1 = await db.document.create({
      data: {
        studentProfileId,
        type: 'ACADEMIC_RECORD',
        fileName: 'transcript.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        storageKey: `test/${tag}/1`,
      },
      select: { id: true },
    });
    const doc2 = await db.document.create({
      data: {
        studentProfileId,
        type: 'PROOF_OF_REGISTRATION',
        fileName: 'registration.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        storageKey: `test/${tag}/2`,
      },
      select: { id: true },
    });

    console.log('\nTEST D — the funder asks for specific things');
    const deadline = new Date(Date.now() + 14 * 86_400_000);
    const created = await createRequest({
      applicationId: application.id,
      organisationId: orgId,
      requestedById: reviewer.id,
      items: [
        // A custom requirement, in the funder's own words.
        { label: 'Please provide a certified copy of your latest university academic record.' },
        { label: 'Proof of registration', documentType: 'PROOF_OF_REGISTRATION' },
      ],
      message: 'We need these to complete your review.',
      deadline,
    });
    check('the request is created', created.ok);
    check('both items are stored', created.ok && created.value.items.length === 2);

    const stored = await requestsForApplication(application.id);
    check('the funder can see the request', stored.length === 1);
    check(
      'the custom wording is preserved exactly',
      stored[0].items.some(
        (i) =>
          i.label === 'Please provide a certified copy of your latest university academic record.',
      ),
      stored[0].items.map((i) => i.label).join(' | '),
    );
    check('the deadline is stored', stored[0].deadline?.getTime() === deadline.getTime());
    check('the message is stored', stored[0].message === 'We need these to complete your review.');

    const afterRequest = await db.application.findUniqueOrThrow({
      where: { id: application.id },
      select: { status: true },
    });
    check('the application shows Documents Required', afterRequest.status === 'DOCUMENTS_REQUIRED');

    const notified = await db.notification.findFirst({
      where: { userId: student.id, type: 'INFORMATION_REQUESTED' },
      select: { body: true, link: true },
    });
    check('the student is notified', Boolean(notified));
    check(
      '...and the notification names what was asked for',
      /academic record/i.test(notified?.body ?? ''),
    );
    check(
      '...and links to the application',
      notified?.link === `/student/applications/${application.id}`,
    );

    console.log('\nThe student sees it and responds');
    const forStudent = await requestForStudent(stored[0].id, studentProfileId);
    check('the student can open the request', Boolean(forStudent));
    const open = await openRequestsForStudent(studentProfileId);
    check('it appears in their outstanding requests', open.length === 1);

    const otherStudent = await db.user.create({
      data: {
        email: `other.${tag}@example.test`,
        passwordHash: 'x',
        role: 'STUDENT',
        firstName: 'Other',
        lastName: 'Student',
        studentProfile: { create: {} },
      },
      select: { studentProfile: { select: { id: true } } },
    });
    const intruder = await requestForStudent(stored[0].id, otherStudent.studentProfile!.id);
    check('another student cannot read it', intruder === null);

    const items = forStudent!.items;
    const attached = await attachDocument({
      studentProfileId,
      itemId: items[0].id,
      documentId: doc1.id,
    });
    check('a document can be attached to an item', attached.ok);

    const wrongOwner = await attachDocument({
      studentProfileId: otherStudent.studentProfile!.id,
      itemId: items[1].id,
      documentId: doc2.id,
    });
    check('another student cannot attach to it', !wrongOwner.ok);

    const notMyDocument = await attachDocument({
      studentProfileId,
      itemId: items[1].id,
      documentId: 'not-a-real-document',
    });
    check('a document that is not theirs is refused', !notMyDocument.ok);

    const detached = await detachDocument(studentProfileId, items[0].id);
    check('an attachment can be changed', detached.ok);
    await attachDocument({ studentProfileId, itemId: items[0].id, documentId: doc1.id });
    await attachDocument({ studentProfileId, itemId: items[1].id, documentId: doc2.id });

    console.log('\nSubmitting the response');
    const submitted = await submitResponse(studentProfileId, stored[0].id, student.id);
    check('the response is submitted', submitted.ok);
    check('both documents are counted', submitted.ok && submitted.value.supplied === 2);

    const afterSubmit = await db.application.findUniqueOrThrow({
      where: { id: application.id },
      select: { status: true },
    });
    check('the application moves back to Under Review', afterSubmit.status === 'UNDER_REVIEW');

    const reviewerNotified = await db.notification.findFirst({
      where: { userId: reviewer.id },
      select: { body: true },
    });
    check('the funder is notified of the response', Boolean(reviewerNotified));

    console.log('\nThe funder sees what was supplied');
    const reviewed = await requestsForApplication(application.id);
    check('the request is marked responded', reviewed[0].status === 'RESPONDED');
    check(
      'every item carries its document',
      reviewed[0].items.every((i) => i.document !== null),
    );
    check(
      'the documents are the ones the student attached',
      reviewed[0].items
        .map((i) => i.document!.fileName)
        .sort()
        .join(',') === 'registration.pdf,transcript.pdf',
    );

    console.log('\nEdge cases');
    const twice = await submitResponse(studentProfileId, stored[0].id, student.id);
    check('a responded request cannot be submitted again', !twice.ok);

    const empty = await createRequest({
      applicationId: application.id,
      organisationId: orgId,
      requestedById: reviewer.id,
      items: [{ label: '   ' }],
    });
    check('a request with nothing in it is refused', !empty.ok);

    const wrongOrg = await createRequest({
      applicationId: application.id,
      organisationId: 'another-org',
      requestedById: reviewer.id,
      items: [{ label: 'Something' }],
    });
    check('another organisation cannot request from this applicant', !wrongOrg.ok);

    const second = await createRequest({
      applicationId: application.id,
      organisationId: orgId,
      requestedById: reviewer.id,
      items: [{ label: 'One more thing' }],
    });
    check('a second request can be sent', second.ok);
    const nothingAttached = await submitResponse(
      studentProfileId,
      second.ok ? second.value.id : '',
      student.id,
    );
    check('submitting with nothing attached is refused', !nothingAttached.ok);

    const cancelled = await cancelRequest(second.ok ? second.value.id : '', orgId, reviewer.id);
    check('a request can be withdrawn', cancelled.ok);
    const afterCancel = await requestsForApplication(application.id);
    check(
      'a withdrawn request is kept, not deleted',
      afterCancel.some((r) => r.status === 'CANCELLED'),
    );
  } finally {
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

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
