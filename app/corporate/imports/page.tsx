import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { Badge, ButtonLink, Card, EmptyState } from '@/components/ui';
import { Upload } from '@/components/icons';
import { requireCorporate } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { listBatches } from '@/services/application-import';

export const metadata: Metadata = { title: 'Imports' };

const STATUS_TONE = {
  UPLOADING: 'neutral',
  EXTRACTING: 'info',
  READY_FOR_REVIEW: 'warning',
  IMPORTING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
} as const;

const STATUS_LABEL = {
  UPLOADING: 'Uploading',
  EXTRACTING: 'Reading',
  READY_FOR_REVIEW: 'Waiting for review',
  IMPORTING: 'Importing',
  COMPLETED: 'Imported',
  FAILED: 'Failed',
} as const;

/** Import history: every batch this organisation has ever uploaded. */
export default async function ImportsPage() {
  const { organisationId } = await requireCorporate();

  const [batches, programmeCount] = await Promise.all([
    listBatches(organisationId),
    prisma.fundingProgramme.count({ where: { organisationId } }),
  ]);

  return (
    <>
      <PageHeader
        title="Imports"
        description="Applications your organisation received outside Bursary-Bridge, brought into the same pipeline as the ones submitted here."
        actions={
          programmeCount > 0 ? (
            <ButtonLink href="/corporate/imports/new">
              <Upload className="mr-2 h-4 w-4" />
              New import
            </ButtonLink>
          ) : null
        }
      />
      <PageBody>
        {programmeCount === 0 ? (
          <EmptyState
            title="Create a programme first"
            description="An imported application is scored against a programme's criteria, so there has to be a programme to import it into."
            action={<ButtonLink href="/corporate/programmes/new">Create a programme</ButtonLink>}
          />
        ) : batches.length === 0 ? (
          <EmptyState
            title="No imports yet"
            description="Upload the application forms you received by email or on paper. Each one is read, scored against the programme and checked against what you already hold, and nothing becomes an applicant until you confirm it."
            action={<ButtonLink href="/corporate/imports/new">Start an import</ButtonLink>}
          />
        ) : (
          <Card>
            <div className="divide-y divide-line">
              {batches.map((batch) => (
                <Link
                  key={batch.id}
                  href={`/corporate/imports/${batch.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {batch.reference}
                      <Badge tone={STATUS_TONE[batch.status]}>{STATUS_LABEL[batch.status]}</Badge>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {batch.fundingProgramme.name}
                      {batch.createdBy && (
                        <>
                          {' · '}
                          {batch.createdBy.firstName} {batch.createdBy.lastName}
                        </>
                      )}
                      {' · '}
                      {batch.createdAt.toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <div>
                      <dt className="text-muted">Files</dt>
                      <dd className="font-semibold text-ink">{batch.totalFiles}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Imported</dt>
                      <dd className="font-semibold text-success">{batch.importedCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">To review</dt>
                      <dd className="font-semibold text-warning">
                        {batch.reviewCount + batch.duplicateCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Unreadable</dt>
                      <dd className="font-semibold text-danger">{batch.failedCount}</dd>
                    </div>
                  </dl>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </PageBody>
    </>
  );
}
