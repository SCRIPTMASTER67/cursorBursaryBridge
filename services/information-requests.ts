import 'server-only';
import type { DocumentType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { notify } from '@/services/notifications';
import { audit } from '@/services/audit';

/**
 * A funder asking an applicant for something specific.
 *
 * Stored rather than sent as a message, so both sides can see exactly what was
 * asked for, what has been supplied and what is still outstanding. A request
 * that lived only in a modal would leave the student with a status change and
 * no way to know what to do about it.
 *
 * The funder's own words are preserved exactly. A funder who asks for "a
 * certified copy of your latest university academic record" must not have it
 * flattened into "Academic record" — the specificity is the point.
 */

export type RequestItemInput = {
  /** The funder's own wording. */
  label: string;
  /** Set when the ask maps onto a document type the student already has a slot for. */
  documentType?: DocumentType | null;
};

export type CreateRequestInput = {
  applicationId: string;
  organisationId: string;
  requestedById: string;
  items: RequestItemInput[];
  message?: string | null;
  deadline?: Date | null;
};

export async function createRequest(input: CreateRequestInput) {
  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, organisationId: input.organisationId },
    select: {
      id: true,
      status: true,
      studentProfile: { select: { userId: true } },
      fundingProgramme: {
        select: { name: true, organisation: { select: { name: true } } },
      },
    },
  });
  if (!application) return { ok: false as const, reason: 'That application was not found.' };
  if (application.status === 'DRAFT') {
    return { ok: false as const, reason: 'This application has not been submitted yet.' };
  }

  const items = input.items
    .map((item) => ({ ...item, label: item.label.trim() }))
    .filter((item) => item.label.length > 0);
  if (items.length === 0) {
    return { ok: false as const, reason: 'Add at least one thing you need from the applicant.' };
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.informationRequest.create({
      data: {
        applicationId: input.applicationId,
        organisationId: input.organisationId,
        requestedById: input.requestedById,
        message: input.message?.trim() || null,
        deadline: input.deadline ?? null,
        items: {
          create: items.map((item) => ({
            label: item.label.slice(0, 500),
            documentType: item.documentType ?? null,
          })),
        },
      },
      select: { id: true, items: { select: { id: true, label: true } } },
    });

    // The application reflects that the funder is waiting on the student.
    await tx.application.update({
      where: { id: input.applicationId },
      data: { status: 'DOCUMENTS_REQUIRED', lastStatusChangeAt: new Date() },
    });

    return created;
  });

  const summary = items
    .slice(0, 3)
    .map((item) => item.label)
    .join(', ');

  await notify({
    userId: application.studentProfile.userId,
    type: 'INFORMATION_REQUESTED',
    title: 'Additional information required',
    body:
      `${application.fundingProgramme.organisation.name} needs more information for your ` +
      `${application.fundingProgramme.name} application: ${summary}` +
      (items.length > 3 ? ` and ${items.length - 3} more.` : '.'),
    link: `/student/applications/${input.applicationId}`,
  });

  await audit({
    userId: input.requestedById,
    action: 'application.information_requested',
    entityType: 'InformationRequest',
    entityId: request.id,
    metadata: { applicationId: input.applicationId, items: items.length },
  });

  return { ok: true as const, value: request };
}

/** Withdraw a request the funder no longer needs answered. */
export async function cancelRequest(requestId: string, organisationId: string, userId: string) {
  const request = await prisma.informationRequest.findFirst({
    where: { id: requestId, organisationId, status: 'OPEN' },
    select: { id: true, applicationId: true },
  });
  if (!request) return { ok: false as const, reason: 'That request was not found.' };

  await prisma.informationRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  await audit({
    userId,
    action: 'application.information_request_cancelled',
    entityType: 'InformationRequest',
    entityId: requestId,
  });

  return { ok: true as const, value: request };
}

const REQUEST_SELECT = {
  id: true,
  message: true,
  deadline: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  requestedBy: { select: { firstName: true, lastName: true } },
  organisation: { select: { name: true } },
  application: {
    select: {
      id: true,
      status: true,
      fundingProgramme: { select: { name: true, organisation: { select: { name: true } } } },
    },
  },
  items: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      label: true,
      documentType: true,
      fulfilledAt: true,
      document: {
        select: { id: true, fileName: true, type: true, sizeBytes: true, storageKey: true },
      },
    },
  },
} satisfies Prisma.InformationRequestSelect;

export type RequestDetail = Prisma.InformationRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

/** Requests on one application, for whichever side is looking. */
export async function requestsForApplication(applicationId: string) {
  return prisma.informationRequest.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
    select: REQUEST_SELECT,
  });
}

/** One request, scoped to the student it was sent to. */
export async function requestForStudent(requestId: string, studentProfileId: string) {
  return prisma.informationRequest.findFirst({
    where: { id: requestId, application: { studentProfileId } },
    select: REQUEST_SELECT,
  });
}

/** Everything still waiting on this student. */
export async function openRequestsForStudent(studentProfileId: string) {
  return prisma.informationRequest.findMany({
    where: { application: { studentProfileId }, status: 'OPEN' },
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
    select: REQUEST_SELECT,
  });
}

/**
 * Attach a document the student has supplied to one requested item.
 *
 * Ownership is checked on both sides: the request must belong to this student,
 * and so must the document. A student cannot attach somebody else's file, and
 * cannot answer somebody else's request.
 */
export async function attachDocument(input: {
  studentProfileId: string;
  itemId: string;
  documentId: string;
}) {
  const item = await prisma.informationRequestItem.findFirst({
    where: {
      id: input.itemId,
      request: { application: { studentProfileId: input.studentProfileId }, status: 'OPEN' },
    },
    select: { id: true, requestId: true },
  });
  if (!item) return { ok: false as const, reason: 'That request item was not found.' };

  const document = await prisma.document.findFirst({
    where: { id: input.documentId, studentProfileId: input.studentProfileId },
    select: { id: true },
  });
  if (!document) return { ok: false as const, reason: 'That document was not found.' };

  await prisma.informationRequestItem.update({
    where: { id: item.id },
    data: { documentId: document.id, fulfilledAt: new Date() },
  });

  return { ok: true as const, value: { itemId: item.id } };
}

export async function detachDocument(studentProfileId: string, itemId: string) {
  const item = await prisma.informationRequestItem.findFirst({
    where: { id: itemId, request: { application: { studentProfileId }, status: 'OPEN' } },
    select: { id: true },
  });
  if (!item) return { ok: false as const, reason: 'That request item was not found.' };

  await prisma.informationRequestItem.update({
    where: { id: itemId },
    data: { documentId: null, fulfilledAt: null },
  });
  return { ok: true as const, value: { itemId } };
}

/**
 * Submit the response.
 *
 * The student decides when they are finished. Nothing is submitted
 * automatically on the last upload, because a student may want to replace a
 * file before the funder sees it.
 */
export async function submitResponse(studentProfileId: string, requestId: string, userId: string) {
  const request = await prisma.informationRequest.findFirst({
    where: { id: requestId, application: { studentProfileId }, status: 'OPEN' },
    select: {
      id: true,
      applicationId: true,
      organisationId: true,
      items: { select: { id: true, label: true, documentId: true } },
      application: {
        select: {
          fundingProgramme: { select: { name: true } },
          studentProfile: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });
  if (!request) return { ok: false as const, reason: 'That request was not found.' };

  const outstanding = request.items.filter((item) => !item.documentId);
  if (outstanding.length === request.items.length) {
    return {
      ok: false as const,
      reason: 'Attach at least one document before submitting your response.',
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.informationRequest.update({
      where: { id: requestId },
      data: { status: 'RESPONDED', respondedAt: new Date() },
    });

    // Only move the application on once nothing else is outstanding on it.
    const stillOpen = await tx.informationRequest.count({
      where: { applicationId: request.applicationId, status: 'OPEN' },
    });
    if (stillOpen === 0) {
      await tx.application.update({
        where: { id: request.applicationId },
        data: { status: 'UNDER_REVIEW', lastStatusChangeAt: new Date() },
      });
    }
  });

  // Tell the funder's reviewers that there is something to look at.
  const reviewers = await prisma.corporateProfile.findMany({
    where: { organisationId: request.organisationId },
    select: { userId: true },
  });
  const student = request.application.studentProfile.user;
  for (const reviewer of reviewers) {
    await notify({
      userId: reviewer.userId,
      type: 'INFORMATION_REQUESTED',
      title: 'Requested information supplied',
      body: `${student.firstName} ${student.lastName} has responded to your request for ${request.application.fundingProgramme.name}.`,
      link: `/corporate/applications/${request.applicationId}`,
    });
  }

  await audit({
    userId,
    action: 'application.information_supplied',
    entityType: 'InformationRequest',
    entityId: requestId,
    metadata: {
      supplied: request.items.length - outstanding.length,
      outstanding: outstanding.length,
    },
  });

  return {
    ok: true as const,
    value: { supplied: request.items.length - outstanding.length, outstanding: outstanding.length },
  };
}
