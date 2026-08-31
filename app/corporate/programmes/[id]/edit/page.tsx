import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ProgrammeBuilder } from '@/components/corporate/programme-builder';
import { ChevronRight } from '@/components/icons';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getCatalog } from '@/services/catalog';

export const metadata: Metadata = { title: 'Edit programme' };

export default async function EditProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organisationId } = await requireCorporate();

  const [programme, catalog] = await Promise.all([
    prisma.fundingProgramme.findFirst({
      where: { id, organisationId },
      include: {
        eligibility: true,
        questions: { orderBy: { order: 'asc' } },
        supportedInstitutions: { select: { institutionId: true } },
        supportedProgrammes: { select: { programmeId: true } },
      },
    }),
    getCatalog(),
  ]);

  if (!programme) notFound();

  return (
    <PageBody>
      <PageHeader
        title="Edit programme"
        description={programme.name}
        breadcrumb={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-ink-400">
            <Link href="/corporate/programmes" className="hover:text-ink-600">
              Programmes
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/corporate/programmes/${programme.id}`} className="truncate hover:text-ink-600">
              {programme.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-ink-600">Edit</span>
          </nav>
        }
      />
      <ProgrammeBuilder
        catalog={catalog}
        mode="edit"
        programmeId={programme.id}
        initial={{
          details: {
            name: programme.name,
            shortDescription: programme.shortDescription,
            fullDescription: programme.fullDescription,
            fundingType: programme.fundingType,
            coverage: programme.coverage,
            openDate: programme.openDate.toISOString().slice(0, 10),
            closingDate: programme.closingDate.toISOString().slice(0, 10),
            intakeTarget: programme.intakeTarget ? String(programme.intakeTarget) : '',
          },
          eligibility: {
            institutionIds: programme.supportedInstitutions.map((i) => i.institutionId),
            programmeIds: programme.supportedProgrammes.map((p) => p.programmeId),
            qualificationLevels: programme.eligibility?.qualificationLevels ?? [],
            minAcademicAverage: programme.eligibility?.minAcademicAverage
              ? String(programme.eligibility.minAcademicAverage)
              : '',
            yearsOfStudy: programme.eligibility?.yearsOfStudy ?? [],
            citizenship: programme.eligibility?.citizenship ?? [],
            maxHouseholdIncome: programme.eligibility?.maxHouseholdIncome ?? '',
            requiresFinancialNeed: programme.eligibility?.requiresFinancialNeed ?? false,
            provinces: programme.eligibility?.provinces ?? [],
            otherRequirements: programme.eligibility?.otherRequirements ?? '',
            requiredDocuments: programme.eligibility?.requiredDocuments ?? [],
          },
          questions: programme.questions.map((question) => ({
            label: question.label,
            helpText: question.helpText ?? '',
            type: question.type,
            required: question.required,
            options: question.options,
          })),
        }}
      />
    </PageBody>
  );
}
