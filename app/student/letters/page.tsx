import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Mail, Plus } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { formatDate } from '@/lib/utils';
import { lettersFor } from '@/services/motivational-letters';

export const metadata: Metadata = { title: 'Motivational letters' };
export const dynamic = 'force-dynamic';

/** Every letter the student has written, newest first. */
export default async function LettersPage() {
  const { studentProfileId } = await requireOnboardedStudent();
  const letters = await lettersFor(studentProfileId);

  return (
    <PageBody>
      <PageHeader
        title="Motivational letters"
        description="A letter for each bursary, built from your profile and your own words."
        actions={
          <ButtonLink href="/student/letters/new">
            <Plus className="h-4 w-4" />
            Write a letter
          </ButtonLink>
        }
      />

      {letters.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Mail className="h-5 w-5" />}
            title="You have not written a letter yet"
            description="Most bursaries ask for one. We will put together a first draft from your profile and the answers you give, and you edit it from there."
            action={
              <ButtonLink href="/student/letters/new">
                <Plus className="h-4 w-4" />
                Write my first letter
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3">
          {letters.map((letter) => (
            <li key={letter.id}>
              <Link
                href={`/student/letters/${letter.id}`}
                className="block rounded-xl border border-line bg-white px-5 py-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">{letter.title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-500">
                      {letter.opportunityName} · {letter.organisationName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {letter.editedByStudent && <Badge tone="neutral">Edited by you</Badge>}
                    <Badge tone={letter.status === 'READY' ? 'success' : 'neutral'}>
                      {letter.status === 'READY' ? 'Ready' : 'Draft'}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  Last changed {formatDate(letter.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageBody>
  );
}
