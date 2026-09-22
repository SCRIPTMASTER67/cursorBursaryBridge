import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { AutoFillReview } from '@/components/student/auto-fill/review';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { ArrowLeft, Download } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { getTargetForm } from '@/services/auto-fill';

export const metadata: Metadata = { title: 'Review a filled form' };

export default async function AutoFillReviewPage({
  params,
}: {
  params: Promise<{ id: string; formId: string }>;
}) {
  const { studentProfileId } = await requireOnboardedStudent();
  const { id, formId } = await params;

  const form = await getTargetForm(formId, studentProfileId);
  if (!form || form.job.id !== id) notFound();

  return (
    <PageBody>
      <Link
        href={`/student/auto-fill/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Your filled forms
      </Link>

      <PageHeader
        title="Review before you submit"
        description="This is the form as it will be downloaded. Check everything we filled in, add what is missing, and sign it yourself once you have printed it or opened it in a PDF reader."
        actions={
          form.status === 'COMPLETED' ? (
            <ButtonLink
              href={`/api/student/auto-fill/forms/${form.id}/download`}
              leadingIcon={<Download className="h-[18px] w-[18px]" />}
            >
              Download PDF
            </ButtonLink>
          ) : undefined
        }
      />

      {form.status !== 'COMPLETED' ? (
        <Alert tone="warning" title="This form was not filled in">
          {form.failureReason ?? 'This form could not be read.'}
        </Alert>
      ) : (
        <AutoFillReview
          formId={form.id}
          fileName={form.originalFileName}
          fieldsTotal={form.fieldsTotal}
          fieldsFilled={form.fieldsFilled}
          fieldsOutstanding={form.fieldsOutstanding}
          fields={form.fields.map((field) => ({
            id: field.id,
            fieldName: field.fieldName,
            label: field.label,
            kind: field.kind,
            page: field.page,
            status: field.status,
            value: field.value,
            reason: field.reason,
            options: field.options,
            sourceDocumentName: field.sourceDocumentName,
            sourcePage: field.sourcePage,
            sourceFieldLabel: field.sourceFieldLabel,
            rectX: field.rectX,
            rectY: field.rectY,
            rectWidth: field.rectWidth,
            rectHeight: field.rectHeight,
            editedByStudent: field.editedByStudent,
          }))}
        />
      )}
    </PageBody>
  );
}
