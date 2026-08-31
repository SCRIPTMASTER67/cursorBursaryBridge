import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, apiStudent, zodFields } from '@/lib/auth/api';
import { applicationDraftSchema, submitApplicationSchema } from '@/lib/validation/application';
import { getMatchForProgramme } from '@/services/matching';
import { notify } from '@/services/notifications';
import { audit } from '@/services/audit';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';

/**
 * Create or update an application.
 *
 * `intent: "draft"` saves progress; `intent: "submit"` validates the full
 * payload, snapshots the match score and moves the application to SUBMITTED.
 * The score is stored at submission time so the funder always sees the match
 * as it stood when the student applied, even if the profile changes later.
 */
export async function POST(request: NextRequest) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const ip = clientIp(request);
  const limit = rateLimit(`apply:${auth.user.id}`, 30, 300);
  if (!limit.allowed) {
    return apiError('You are submitting too quickly. Please wait a moment and try again.', 429);
  }

  const body = (await request.json().catch(() => null)) as
    | { intent?: 'draft' | 'submit'; [key: string]: unknown }
    | null;
  if (!body) return apiError('Invalid request.');

  const intent = body.intent === 'submit' ? 'submit' : 'draft';
  const schema = intent === 'submit' ? submitApplicationSchema : applicationDraftSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
  }

  const { fundingProgrammeId, answers, documentIds } = parsed.data;

  const programme = await prisma.fundingProgramme.findUnique({
    where: { id: fundingProgrammeId },
    select: {
      id: true,
      name: true,
      status: true,
      closingDate: true,
      organisationId: true,
      organisation: { select: { name: true } },
      questions: { select: { id: true, label: true, type: true, required: true } },
      eligibility: { select: { requiredDocuments: true } },
    },
  });

  if (!programme || programme.status !== 'PUBLISHED') {
    return apiError('This opportunity is no longer accepting applications.', 404);
  }
  if (programme.closingDate.getTime() < Date.now()) {
    return apiError('This opportunity has closed.', 409);
  }

  // Only documents belonging to this student may be attached.
  if (documentIds.length > 0) {
    const owned = await prisma.document.count({
      where: { id: { in: documentIds }, studentProfileId: auth.studentProfileId },
    });
    if (owned !== documentIds.length) {
      return apiError('One of the selected documents could not be found.', 422);
    }
  }

  if (intent === 'submit') {
    // Programme-specific required questions must be answered.
    const missing = programme.questions
      .filter((question) => {
        if (!question.required) return false;
        const answer = answers[question.id];
        if (answer === undefined || answer === null || answer === '') return true;
        return Array.isArray(answer) && answer.length === 0;
      })
      .map((question) => question.id);

    if (missing.length > 0) {
      return apiError(
        'Please answer all required questions before submitting.',
        422,
        Object.fromEntries(missing.map((id) => [`answers.${id}`, 'This question is required'])),
      );
    }
  }

  const existing = await prisma.application.findUnique({
    where: {
      studentProfileId_fundingProgrammeId: {
        studentProfileId: auth.studentProfileId,
        fundingProgrammeId,
      },
    },
    select: { id: true, status: true },
  });

  // A submitted application cannot be silently rewritten by a later draft save.
  if (existing && existing.status !== 'DRAFT') {
    return apiError('You have already submitted an application to this opportunity.', 409);
  }

  const match = intent === 'submit' ? await getMatchForProgramme(auth.studentProfileId, fundingProgrammeId) : null;
  const now = new Date();

  const application = await prisma.application.upsert({
    where: {
      studentProfileId_fundingProgrammeId: {
        studentProfileId: auth.studentProfileId,
        fundingProgrammeId,
      },
    },
    create: {
      studentProfileId: auth.studentProfileId,
      fundingProgrammeId,
      organisationId: programme.organisationId,
      status: intent === 'submit' ? 'SUBMITTED' : 'DRAFT',
      answers,
      submittedAt: intent === 'submit' ? now : null,
      lastStatusChangeAt: intent === 'submit' ? now : null,
      matchScore: match?.match.matchScore ?? null,
      matchClassification: match?.match.classification ?? null,
      matchReasons: match ? (match.match.criteria as object) : undefined,
    },
    update: {
      status: intent === 'submit' ? 'SUBMITTED' : 'DRAFT',
      answers,
      submittedAt: intent === 'submit' ? now : null,
      lastStatusChangeAt: intent === 'submit' ? now : undefined,
      matchScore: match?.match.matchScore ?? undefined,
      matchClassification: match?.match.classification ?? undefined,
      matchReasons: match ? (match.match.criteria as object) : undefined,
    },
    select: { id: true },
  });

  // Re-link documents to reflect the current selection.
  await prisma.applicationDocument.deleteMany({ where: { applicationId: application.id } });
  if (documentIds.length > 0) {
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, studentProfileId: auth.studentProfileId },
      select: { id: true, type: true },
    });
    await prisma.applicationDocument.createMany({
      data: documents.map((document) => ({
        applicationId: application.id,
        documentId: document.id,
        requirement: document.type,
      })),
    });
  }

  if (intent === 'submit') {
    await notify({
      userId: auth.user.id,
      type: 'APPLICATION_SUBMITTED',
      title: 'Application submitted',
      body: `Your application to ${programme.name} at ${programme.organisation.name} has been submitted. We'll let you know as soon as the funder responds.`,
      link: `/student/applications/${application.id}`,
    });
  }

  await audit({
    userId: auth.user.id,
    action: intent === 'submit' ? 'application.submitted' : 'application.draft_saved',
    entityType: 'Application',
    entityId: application.id,
    ipAddress: ip,
  });

  return apiOk({
    ok: true,
    applicationId: application.id,
    redirectTo:
      intent === 'submit' ? `/student/applications/${application.id}?submitted=1` : '/student/applications',
  });
}
