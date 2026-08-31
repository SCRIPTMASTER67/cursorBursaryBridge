import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody } from '@/components/layout/app-shell';
import { OpportunityDetail } from '@/components/student/opportunity-detail';
import { ArrowLeft } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getMatchForProgramme } from '@/services/matching';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const programme = await prisma.fundingProgramme.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: programme?.name ?? 'Opportunity' };
}

export default async function OpportunityDetailPage({ params }: Params) {
  const { id } = await params;
  const { studentProfileId } = await requireOnboardedStudent();

  const [result, application] = await Promise.all([
    getMatchForProgramme(studentProfileId, id),
    prisma.application.findUnique({
      where: { studentProfileId_fundingProgrammeId: { studentProfileId, fundingProgrammeId: id } },
      select: { id: true, status: true },
    }),
  ]);

  // A draft programme belongs to its funder alone and must not be readable here.
  if (!result || result.programme.status !== 'PUBLISHED') notFound();

  return (
    <PageBody>
      <Link
        href="/student/opportunities"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to opportunities
      </Link>

      <OpportunityDetail
        programme={result.programme}
        match={result.match}
        application={application}
      />
    </PageBody>
  );
}
