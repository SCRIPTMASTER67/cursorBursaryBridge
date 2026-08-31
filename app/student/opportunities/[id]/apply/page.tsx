import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageBody } from '@/components/layout/app-shell';
import { ApplicationWizard } from '@/components/student/application-wizard';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getMatchForProgramme } from '@/services/matching';
import { buildStudentSummary } from '@/services/student-summary';

export const metadata: Metadata = { title: 'Apply' };

type Params = { params: Promise<{ id: string }> };

/**
 * The application form.
 *
 * The student's stored profile is presented read-only — they are never asked to
 * retype information Bursary-Bridge already holds. Only programme-specific
 * questions and documents are collected here.
 */
export default async function ApplyPage({ params }: Params) {
  const { id } = await params;
  const { studentProfileId } = await requireOnboardedStudent();

  const [result, summary, existing, documents] = await Promise.all([
    getMatchForProgramme(studentProfileId, id),
    buildStudentSummary(studentProfileId),
    prisma.application.findUnique({
      where: { studentProfileId_fundingProgrammeId: { studentProfileId, fundingProgrammeId: id } },
      select: { id: true, status: true, answers: true },
    }),
    prisma.document.findMany({
      where: { studentProfileId },
      select: { id: true, type: true, fileName: true, uploadedAt: true },
      orderBy: { uploadedAt: 'desc' },
    }),
  ]);

  if (!result || result.programme.status !== 'PUBLISHED') notFound();

  // Already submitted — send them to the tracking view instead.
  if (existing && existing.status !== 'DRAFT') {
    redirect(`/student/applications/${existing.id}`);
  }

  const questions = await prisma.applicationQuestion.findMany({
    where: { fundingProgrammeId: id },
    orderBy: { order: 'asc' },
  });

  return (
    <PageBody>
      <ApplicationWizard
        programme={{
          id: result.programme.id,
          name: result.programme.name,
          organisationName: result.programme.organisation.name,
          closingDate: result.programme.closingDate.toISOString(),
          requiredDocuments: result.programme.eligibility?.requiredDocuments ?? [],
        }}
        match={result.match}
        summary={summary}
        questions={questions.map((question) => ({
          id: question.id,
          label: question.label,
          helpText: question.helpText,
          type: question.type,
          required: question.required,
          options: question.options,
        }))}
        documents={documents.map((document) => ({
          id: document.id,
          type: document.type,
          fileName: document.fileName,
        }))}
        savedAnswers={(existing?.answers as Record<string, string | string[]> | null) ?? {}}
      />
    </PageBody>
  );
}
