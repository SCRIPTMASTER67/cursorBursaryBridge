import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ProgrammeBuilder } from '@/components/corporate/programme-builder';
import { ChevronRight } from '@/components/icons';
import { requireCorporate } from '@/lib/auth/guards';
import { getCatalog } from '@/services/catalog';

export const metadata: Metadata = { title: 'Create programme' };

export default async function NewProgrammePage() {
  await requireCorporate();
  const catalog = await getCatalog();

  return (
    <PageBody>
      <PageHeader
        title="Create New Programme"
        description="Set up your funding programme and eligibility criteria."
        breadcrumb={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-ink-400">
            <Link href="/corporate/programmes" className="hover:text-ink-600">
              Programmes
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-ink-600">Create New Programme</span>
          </nav>
        }
      />
      <ProgrammeBuilder catalog={catalog} />
    </PageBody>
  );
}
