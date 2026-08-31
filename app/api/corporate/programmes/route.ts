import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiCorporate, apiError, apiOk, zodFields } from '@/lib/auth/api';
import { createProgrammeSchema } from '@/lib/validation/programme';
import { slugify } from '@/lib/utils';
import { audit } from '@/services/audit';

/**
 * Create a funding programme with its eligibility rules and questions.
 *
 * Written in one transaction so a programme can never exist without the rule
 * set the matching and eligibility services depend on.
 */
export async function POST(request: NextRequest) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return apiError('Invalid request.');

  const parsed = createProgrammeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
  }

  const { details, eligibility, questions, publish } = parsed.data;

  // Every referenced institution and course must exist in the catalogue.
  if (eligibility.institutionIds.length > 0) {
    const count = await prisma.institution.count({ where: { id: { in: eligibility.institutionIds } } });
    if (count !== eligibility.institutionIds.length) {
      return apiError('One of the selected institutions is no longer available.', 422);
    }
  }
  if (eligibility.programmeIds.length > 0) {
    const count = await prisma.programme.count({ where: { id: { in: eligibility.programmeIds } } });
    if (count !== eligibility.programmeIds.length) {
      return apiError('One of the selected courses is no longer available.', 422);
    }
  }

  const slug = await uniqueSlug(details.name);

  const programme = await prisma.fundingProgramme.create({
    data: {
      organisationId: auth.organisationId,
      createdById: auth.user.id,
      name: details.name,
      slug,
      shortDescription: details.shortDescription,
      fullDescription: details.fullDescription,
      fundingType: details.fundingType,
      coverage: details.coverage,
      openDate: new Date(details.openDate),
      closingDate: new Date(details.closingDate),
      status: publish ? 'PUBLISHED' : 'DRAFT',
      intakeTarget: details.intakeTarget ?? null,
      eligibility: {
        create: {
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
      },
      supportedInstitutions: {
        create: eligibility.institutionIds.map((institutionId) => ({ institutionId })),
      },
      supportedProgrammes: {
        create: eligibility.programmeIds.map((programmeId) => ({ programmeId })),
      },
      questions: {
        create: questions.map((question, index) => ({
          label: question.label,
          helpText: question.helpText || null,
          type: question.type,
          required: question.required,
          options: question.options,
          order: index + 1,
        })),
      },
    },
    select: { id: true, name: true },
  });

  await audit({
    userId: auth.user.id,
    action: publish ? 'programme.published' : 'programme.created',
    entityType: 'FundingProgramme',
    entityId: programme.id,
    metadata: { name: programme.name },
  });

  return apiOk(
    { ok: true, programmeId: programme.id, redirectTo: `/corporate/programmes/${programme.id}` },
    201,
  );
}

/** Slugs are unique across the platform, so a clash gets a numeric suffix. */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'programme';
  let candidate = base;
  let suffix = 1;

  // Bounded so a pathological name can never spin here.
  while (suffix < 100) {
    const existing = await prisma.fundingProgramme.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}
