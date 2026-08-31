import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { ProgrammeStatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress';
import { Table, Td, Th, Tr } from '@/components/ui/table-exports';
import { Award, Plus } from '@/components/icons';
import { requireCorporate } from '@/lib/auth/guards';
import { deadlineLabel, formatDate, formatNumber } from '@/lib/utils';
import { getProgrammeSummaries } from '@/services/corporate-stats';

export const metadata: Metadata = { title: 'Programmes' };

export default async function ProgrammesPage() {
  const { organisationId } = await requireCorporate();
  const programmes = await getProgrammeSummaries(organisationId);

  return (
    <PageBody>
      <PageHeader
        title="Programmes"
        description="Every funding programme your organisation has created."
        actions={
          <ButtonLink href="/corporate/programmes/new" leadingIcon={<Plus className="h-4 w-4" />}>
            Create New Programme
          </ButtonLink>
        }
      />

      <Card>
        {programmes.length === 0 ? (
          <EmptyState
            icon={<Award className="h-5 w-5" />}
            title="No programmes yet"
            description="Create your first funding programme and define exactly who is eligible."
            action={
              <ButtonLink href="/corporate/programmes/new" leadingIcon={<Plus className="h-4 w-4" />}>
                Create New Programme
              </ButtonLink>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Programme</Th>
                <Th align="right">Applications</Th>
                <Th align="right">Eligible</Th>
                <Th align="right">Shortlisted</Th>
                <Th>Closes</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {programmes.map((programme) => {
                const rate =
                  programme.applicationCount > 0
                    ? Math.round((programme.eligibleCount / programme.applicationCount) * 100)
                    : 0;
                return (
                  <Tr key={programme.id} interactive>
                    <Td>
                      <Link
                        href={`/corporate/programmes/${programme.id}`}
                        className="block font-semibold text-ink hover:text-brand-700"
                      >
                        {programme.name}
                      </Link>
                      <div className="mt-1.5 flex items-center gap-2">
                        <ProgressBar
                          value={rate}
                          tone={rate >= 70 ? 'success' : 'brand'}
                          className="w-32"
                        />
                        <span className="text-xs tabular-nums text-ink-400">{rate}% eligible</span>
                      </div>
                    </Td>
                    <Td align="right" className="tabular-nums font-medium text-ink">
                      {formatNumber(programme.applicationCount)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatNumber(programme.eligibleCount)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatNumber(programme.shortlistCount)}
                    </Td>
                    <Td>
                      {formatDate(programme.closingDate)}
                      {programme.status === 'PUBLISHED' && (
                        <span className="mt-0.5 block text-xs text-ink-400">
                          {deadlineLabel(programme.closingDate)}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <ProgrammeStatusBadge status={programme.status} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </PageBody>
  );
}
