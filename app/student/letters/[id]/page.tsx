import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { LetterEditor } from '@/components/student/letters/letter-editor';
import { ChevronRight } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { gapsIn } from '@/lib/letters/questions';
import type { LetterAnswers } from '@/lib/letters/types';
import { factsFor, letterFor } from '@/services/motivational-letters';

export const metadata: Metadata = { title: 'Motivational letter' };
export const dynamic = 'force-dynamic';

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studentProfileId } = await requireOnboardedStudent();

  // Scoped to this student's own letters: another student's id returns null.
  const letter = await letterFor(id, studentProfileId);
  if (!letter) notFound();

  const facts = await factsFor(studentProfileId);
  const answers = (letter.answers as LetterAnswers | null) ?? {};

  return (
    <PageBody>
      <PageHeader
        title={letter.title}
        description={`For ${letter.opportunityName} · ${letter.organisationName}`}
        breadcrumb={
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-[13px] text-ink-400"
          >
            <Link href="/student/letters" className="hover:text-ink-600">
              Motivational letters
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-ink-600">{letter.opportunityName}</span>
          </nav>
        }
      />
      <LetterEditor
        gaps={facts ? gapsIn(facts, answers) : []}
        letter={{
          id: letter.id,
          title: letter.title,
          content: letter.content,
          status: letter.status,
          opportunityName: letter.opportunityName,
          organisationName: letter.organisationName,
          editedByStudent: letter.editedByStudent,
          answers,
          generator: letter.generator,
          opportunityHref: letter.fundingProgramme
            ? `/student/opportunities/${letter.fundingProgramme.id}`
            : null,
        }}
      />
    </PageBody>
  );
}
