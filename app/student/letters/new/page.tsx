import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { LetterComposer } from '@/components/student/letters/letter-composer';
import { ChevronRight } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { qualificationLabels } from '@/lib/labels';
import { gapsIn } from '@/lib/letters/questions';
import { factsFor, letterTargets, previousAnswers } from '@/services/motivational-letters';

export const metadata: Metadata = { title: 'Write a letter' };
export const dynamic = 'force-dynamic';

/**
 * Writing a new letter.
 *
 * The facts preview is assembled here rather than in the client component so
 * the student sees exactly what the server will use — the same values, not a
 * description of them.
 */
export default async function NewLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunity?: string }>;
}) {
  const { opportunity } = await searchParams;
  const { studentProfileId } = await requireOnboardedStudent();

  const facts = await factsFor(studentProfileId);
  if (!facts) notFound();

  const [targets, answers] = await Promise.all([
    letterTargets(studentProfileId),
    previousAnswers(studentProfileId),
  ]);

  const preview: { label: string; value: string }[] = [];
  if (facts.programmeName) preview.push({ label: 'Course', value: facts.programmeName });
  if (facts.institutionName) preview.push({ label: 'Institution', value: facts.institutionName });
  if (facts.qualificationLevel) {
    preview.push({
      label: 'Qualification',
      value: qualificationLabels[facts.qualificationLevel],
    });
  }
  if (facts.yearOfStudy !== null) {
    preview.push({ label: 'Year of study', value: `Year ${facts.yearOfStudy}` });
  }
  if (facts.academicAverage !== null) {
    preview.push({ label: 'Academic average', value: `${facts.academicAverage}%` });
  }
  if (facts.results.length > 0) {
    preview.push({
      label: 'Results on file',
      value: `${facts.results.length} subject${facts.results.length === 1 ? '' : 's'}`,
    });
  }
  if (facts.achievements.length > 0) {
    preview.push({ label: 'Achievements', value: facts.achievements.join(', ') });
  }

  return (
    <PageBody>
      <PageHeader
        title="Write a motivational letter"
        description="We put together a first draft from what you tell us and what is already on your profile. Nothing is invented — anything you leave blank is simply left out."
        breadcrumb={
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-[13px] text-ink-400"
          >
            <Link href="/student/letters" className="hover:text-ink-600">
              Motivational letters
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-ink-600">New letter</span>
          </nav>
        }
      />
      <LetterComposer
        targets={targets}
        previousAnswers={answers}
        profileGaps={gapsIn(facts, answers)}
        factsPreview={preview}
        presetTargetId={
          opportunity && targets.some((target) => target.id === opportunity)
            ? opportunity
            : undefined
        }
      />
    </PageBody>
  );
}
