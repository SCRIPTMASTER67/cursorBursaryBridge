import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ResultsManager } from '@/components/student/results-manager';
import { Card, CardBody } from '@/components/ui/card';
import { InfoCircle } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import {
  levelForStage,
  listResults,
  requirementsTouchingResults,
  subjectOptions,
  vocabularyForStage,
} from '@/services/student-results';

export const metadata: Metadata = { title: 'My results' };
export const dynamic = 'force-dynamic';

/**
 * Subject and module results.
 *
 * What the page is called, and what the rows are called, follows the student's
 * education stage: a Grade 12 learner has subjects, a university student has
 * modules. The data model is the same; the vocabulary is theirs.
 */
export default async function StudentResultsPage() {
  const { studentProfileId } = await requireOnboardedStudent();

  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentProfileId },
    select: { educationStage: true, academicAverage: true },
  });

  const level = levelForStage(profile.educationStage);
  const vocabulary = vocabularyForStage(profile.educationStage);

  const [results, subjects, requirements] = await Promise.all([
    listResults(studentProfileId),
    subjectOptions(level),
    requirementsTouchingResults(studentProfileId),
  ]);

  return (
    <PageBody>
      <PageHeader
        title={vocabulary.heading}
        description={`Your ${vocabulary.plural} and the results you achieved. Bursaries that require a specific ${vocabulary.singular} result are checked against these, so what you enter here changes what you match.`}
      />

      <Card className="mb-5">
        <CardBody className="flex gap-3">
          <InfoCircle className="h-[18px] w-[18px] shrink-0 text-ink-400" />
          <div className="text-[13px] text-ink-600">
            <p className="font-semibold text-ink">These are used, not just stored</p>
            <p className="mt-1">
              A bursary asking for Mathematics at 70% is checked against your Mathematics result. If
              you have not entered it yet we say so rather than assuming you do not qualify — see{' '}
              <Link
                href="/student/opportunities"
                className="font-semibold text-brand-600 underline"
              >
                My Matches
              </Link>{' '}
              for the effect.
            </p>
          </div>
        </CardBody>
      </Card>

      <ResultsManager
        level={level}
        vocabulary={vocabulary}
        initial={results.map((row) => ({
          id: row.id,
          percentage: row.percentage,
          grade: row.grade,
          year: row.year,
          term: row.term,
          kind: row.kind,
          level: row.level,
          subject: { id: row.subject.id, name: row.subject.name, custom: row.subject.custom },
        }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, custom: s.custom }))}
        matchedRequirements={requirements.map((r) => ({
          subjectName: r.subject.name,
          minimumPercentage: r.minimumPercentage,
          programmeName: r.eligibilityRule.fundingProgramme.name,
          organisationName: r.eligibilityRule.fundingProgramme.organisation.name,
          slug: r.eligibilityRule.fundingProgramme.slug,
        }))}
      />
    </PageBody>
  );
}
