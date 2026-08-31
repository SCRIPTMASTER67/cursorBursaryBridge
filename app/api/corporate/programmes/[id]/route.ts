import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiCorporate, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { createProgrammeSchema } from '@/lib/validation/programme';
import { audit } from '@/services/audit';

const statusSchema = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']) });

/** Publish, unpublish or close a programme. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Scoped by organisationId: a funder can only touch its own programmes.
  const programme = await prisma.fundingProgramme.findFirst({
    where: { id, organisationId: auth.organisationId },
    select: { id: true, status: true, name: true, closingDate: true },
  });
  if (!programme) return apiError('Programme not found.', 404);

  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid status.', 422, zodFields(parsed.error));

  if (parsed.data.status === 'PUBLISHED' && programme.closingDate.getTime() < Date.now()) {
    return apiError('Set a future closing date before publishing this programme.', 422);
  }

  await prisma.fundingProgramme.update({
    where: { id: programme.id },
    data: { status: parsed.data.status },
  });

  await audit({
    userId: auth.user.id,
    action: `programme.status_${parsed.data.status.toLowerCase()}`,
    entityType: 'FundingProgramme',
    entityId: programme.id,
  });

  return apiOk({ ok: true, status: parsed.data.status });
}

/** Replace a programme's details, eligibility and questions. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const programme = await prisma.fundingProgramme.findFirst({
    where: { id, organisationId: auth.organisationId },
    select: { id: true },
  });
  if (!programme) return apiError('Programme not found.', 404);

  const body = await request.json().catch(() => null);
  const parsed = createProgrammeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
  }

  const { details, eligibility, questions, publish } = parsed.data;

  await prisma.$transaction([
    prisma.fundingProgramme.update({
      where: { id: programme.id },
      data: {
        name: details.name,
        shortDescription: details.shortDescription,
        fullDescription: details.fullDescription,
        fundingType: details.fundingType,
        coverage: details.coverage,
        openDate: new Date(details.openDate),
        closingDate: new Date(details.closingDate),
        intakeTarget: details.intakeTarget ?? null,
        status: publish ? 'PUBLISHED' : undefined,
      },
    }),
    prisma.eligibilityRule.upsert({
      where: { fundingProgrammeId: programme.id },
      create: {
        fundingProgrammeId: programme.id,
        minAcademicAverage: eligibility.minAcademicAverage ?? null,
        qualificationLevels: eligibility.qualificationLevels,
        yearsOfStudy: eligibility.yearsOfStudy,
        citizenship: eligibility.citizenship,
        maxHouseholdIncome: eligibility.maxHouseholdIncome ?? null,
        requiresFinancialNeed: eligibility.requiresFinancialNeed,
        provinces: eligibility.provinces,
        otherRequirements: eligibility.otherRequirements || null,
        requiredDocuments: eligibility.requiredDocuments,
      },
      update: {
        minAcademicAverage: eligibility.minAcademicAverage ?? null,
        qualificationLevels: eligibility.qualificationLevels,
        yearsOfStudy: eligibility.yearsOfStudy,
        citizenship: eligibility.citizenship,
        maxHouseholdIncome: eligibility.maxHouseholdIncome ?? null,
        requiresFinancialNeed: eligibility.requiresFinancialNeed,
        provinces: eligibility.provinces,
        otherRequirements: eligibility.otherRequirements || null,
        requiredDocuments: eligibility.requiredDocuments,
      },
    }),
    // Supported lists and questions are replaced wholesale, so removals apply.
    prisma.fundingProgrammeInstitution.deleteMany({ where: { fundingProgrammeId: programme.id } }),
    prisma.fundingProgrammeProgramme.deleteMany({ where: { fundingProgrammeId: programme.id } }),
    prisma.applicationQuestion.deleteMany({ where: { fundingProgrammeId: programme.id } }),
    prisma.fundingProgrammeInstitution.createMany({
      data: eligibility.institutionIds.map((institutionId) => ({
        fundingProgrammeId: programme.id,
        institutionId,
      })),
    }),
    prisma.fundingProgrammeProgramme.createMany({
      data: eligibility.programmeIds.map((programmeId) => ({
        fundingProgrammeId: programme.id,
        programmeId,
      })),
    }),
    prisma.applicationQuestion.createMany({
      data: questions.map((question, index) => ({
        fundingProgrammeId: programme.id,
        label: question.label,
        helpText: question.helpText || null,
        type: question.type,
        required: question.required,
        options: question.options,
        order: index + 1,
      })),
    }),
  ]);

  await audit({
    userId: auth.user.id,
    action: 'programme.updated',
    entityType: 'FundingProgramme',
    entityId: programme.id,
  });

  return apiOk({ ok: true, redirectTo: `/corporate/programmes/${programme.id}` });
}
