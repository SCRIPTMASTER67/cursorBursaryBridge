import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ButtonLink, EmptyState } from '@/components/ui';
import { ImportWizard } from '@/components/corporate/imports/import-wizard';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';

export const metadata: Metadata = { title: 'New import' };

export default async function NewImportPage() {
  const { organisationId } = await requireCorporate();

  const programmes = await prisma.fundingProgramme.findMany({
    where: { organisationId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <PageHeader
        breadcrumb={
          <nav className="text-xs text-muted">
            <Link href="/corporate/imports" className="hover:text-ink">
              Imports
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink">New import</span>
          </nav>
        }
        title="Import applications"
        description="Upload the application forms your organisation received elsewhere. Every file is stored first, then read, scored and checked for duplicates. Nothing becomes an applicant until you confirm it."
      />
      <PageBody>
        {programmes.length === 0 ? (
          <EmptyState
            title="Create a programme first"
            description="An imported application is scored against a programme's criteria, so there has to be a programme to import it into."
            action={<ButtonLink href="/corporate/programmes/new">Create a programme</ButtonLink>}
          />
        ) : (
          <ImportWizard programmes={programmes} />
        )}
      </PageBody>
    </>
  );
}
