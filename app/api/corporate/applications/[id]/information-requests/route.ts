import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { DocumentType } from '@prisma/client';
import { apiCorporate, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { createRequest, requestsForApplication } from '@/services/information-requests';
import { prisma } from '@/lib/db';

/**
 * Asking an applicant for something specific.
 *
 * Items carry the funder's own wording, so a custom requirement is stored
 * exactly as typed rather than being forced into a predefined document type.
 */
const createSchema = z.object({
  items: z
    .array(
      z.object({
        label: z.string().trim().min(3, 'Describe what you need').max(500),
        documentType: z.string().optional(),
      }),
    )
    .min(1, 'Add at least one thing you need')
    .max(20, 'That is a lot to ask for at once'),
  message: z.string().trim().max(2000).optional(),
  deadline: z.string().trim().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const application = await prisma.application.findFirst({
    where: { id, organisationId: auth.organisationId },
    select: { id: true },
  });
  if (!application) return apiError('That application was not found.', 404);

  return apiOk({ requests: await requestsForApplication(id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError('Check the request.', 422, zodFields(parsed.error));

  let deadline: Date | null = null;
  if (parsed.data.deadline) {
    const parsedDate = new Date(parsed.data.deadline);
    if (Number.isNaN(parsedDate.getTime())) {
      return apiError('That deadline is not a valid date.', 422, { deadline: 'Invalid date' });
    }
    // A deadline already past would leave the student no time to answer.
    if (parsedDate.getTime() < Date.now()) {
      return apiError('Choose a deadline in the future.', 422, {
        deadline: 'Choose a future date',
      });
    }
    deadline = parsedDate;
  }

  const result = await createRequest({
    applicationId: id,
    organisationId: auth.organisationId,
    requestedById: auth.user.id,
    items: parsed.data.items.map((item) => ({
      label: item.label,
      documentType: (item.documentType as DocumentType | undefined) ?? null,
    })),
    message: parsed.data.message,
    deadline,
  });

  if (!result.ok) return apiError(result.reason, 409);
  return apiOk({ ok: true, request: result.value }, 201);
}
