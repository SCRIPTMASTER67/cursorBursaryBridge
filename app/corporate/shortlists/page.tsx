import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ShortlistTable } from '@/components/corporate/shortlist-table';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getShortlistRows } from '@/services/shortlists';

export const metadata: Metadata = { title: 'Shortlists' };

export default async function ShortlistsPage() {
  const { organisationId } = await requireCorporate();

  const [rows, programmes] = await Promise.all([
    getShortlistRows(organisationId, ['SHORTLISTED']),
    prisma.fundingProgramme.findMany({
      where: { organisationId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <PageBody>
      <PageHeader
        title="Shortlists"
        description="Applicants you're considering. Move them to Selected when you're ready to award funding."
      />
      <ShortlistTable rows={rows} programmes={programmes} mode="shortlist" />
    </PageBody>
  );
}
