import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ShortlistTable } from '@/components/corporate/shortlist-table';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getShortlistRows } from '@/services/shortlists';

export const metadata: Metadata = { title: 'Beneficiaries' };

export default async function BeneficiariesPage() {
  const { organisationId } = await requireCorporate();

  const [rows, programmes] = await Promise.all([
    getShortlistRows(organisationId, ['SELECTED']),
    prisma.fundingProgramme.findMany({
      where: { organisationId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <PageBody>
      <PageHeader
        title="Beneficiaries"
        description="Applicants your organisation has selected for funding."
      />
      <ShortlistTable rows={rows} programmes={programmes} mode="beneficiaries" />
    </PageBody>
  );
}
