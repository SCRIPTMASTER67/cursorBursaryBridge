import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { Alert, Badge, Button, ButtonLink, Card, CardBody } from '@/components/ui';
import { ImportProgress } from '@/components/corporate/imports/import-progress';
import {
  ImportReview,
  type ReviewRow,
} from '@/components/corporate/imports/import-review';
import { requireCorporate } from '@/lib/auth/guards';
import { batchFiles, getBatch } from '@/services/application-import';
import { CANONICAL_LABELS, type CanonicalKey } from '@/lib/pdf/profile';

export const metadata: Metadata = { title: 'Import' };

/** The applicant's name as read, for the row heading. */
function nameOf(fields: { canonicalKey: string; value: string; correctedValue: string | null }[]) {
  const get = (key: string) =>
    fields.find((field) => field.canonicalKey === key)?.correctedValue ??
    fields.find((field) => field.canonicalKey === key)?.value ??
    '';
  const first = get('firstName');
  const last = get('lastName');
  if (first && last) return `${first} ${last}`;
  return get('fullName') || first || last || '';
}

export default async function ImportBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { organisationId } = await requireCorporate();
  const { id } = await params;

  const batch = await getBatch(id, organisationId);
  if (!batch) notFound();

  const working = batch.status === 'EXTRACTING' || batch.status === 'UPLOADING';
  const files = working ? [] : await batchFiles(id, organisationId, 'ALL');

  const rows: ReviewRow[] = files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    status: file.status,
    failureReason: file.failureReason,
    method: file.method,
    matchScore: file.matchScore,
    eligibilityOutcome: file.eligibilityOutcome,
    documentsFound: file.documentsFound,
    documentsRequired: file.documentsRequired,
    identity: file.identity,
    duplicateOfFileName: file.duplicateOfFile?.fileName ?? null,
    duplicateReason: file.duplicateReason,
    applicantName: nameOf(file.fields),
    fields: file.fields.map((field) => ({
      id: field.id,
      corrected: field.correctedValue !== null,
      canonicalKey: field.canonicalKey,
      label: CANONICAL_LABELS[field.canonicalKey as CanonicalKey] ?? field.canonicalKey,
      value: field.correctedValue ?? field.value,
      raw: field.raw,
      confidence: field.confidence,
      sourceFieldLabel: field.sourceFieldLabel,
    })),
  }));

  return (
    <>
      <PageHeader
        breadcrumb={
          <nav className="text-xs text-muted">
            <Link href="/corporate/imports" className="hover:text-ink">
              Imports
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink">{batch.reference}</span>
          </nav>
        }
        title={batch.reference}
        description={`${batch.totalFiles} file${batch.totalFiles === 1 ? '' : 's'} for ${batch.fundingProgramme.name}`}
        actions={
          batch.status === 'COMPLETED' ? (
            <ButtonLink
              href={`/corporate/applications?programme=${batch.fundingProgrammeId}`}
              variant="secondary"
            >
              View applicants
            </ButtonLink>
          ) : null
        }
      />
      <PageBody>
        {batch.status === 'FAILED' && (
          <Alert tone="danger" className="mb-4">
            {batch.failureReason ??
              'This import failed. The files you uploaded are kept and nothing was imported.'}
          </Alert>
        )}

        {working ? (
          <ImportProgress
            batchId={batch.id}
            initial={{
              status: batch.status,
              totalFiles: batch.totalFiles,
              processedFiles: batch.processedFiles,
              readyCount: batch.readyCount,
              reviewCount: batch.reviewCount,
              duplicateCount: batch.duplicateCount,
              failedCount: batch.failedCount,
              failureReason: batch.failureReason,
            }}
          />
        ) : (
          <>
            {batch.status === 'COMPLETED' && (
              <Card className="mb-4">
                <CardBody className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {batch.importedCount} applicant
                      {batch.importedCount === 1 ? '' : 's'} imported
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {batch.failedCount > 0 && (
                        <>
                          {batch.failedCount} file{batch.failedCount === 1 ? '' : 's'} could not be
                          read and {batch.failedCount === 1 ? 'is' : 'are'} listed below with the
                          reason.{' '}
                        </>
                      )}
                      Every uploaded file is kept, whatever was decided about it.
                    </p>
                  </div>
                  <Badge tone="success">Completed</Badge>
                </CardBody>
              </Card>
            )}

            <ImportReview
              batchId={batch.id}
              rows={rows}
              alreadyImported={batch.status === 'COMPLETED'}
            />
          </>
        )}
      </PageBody>
    </>
  );
}
