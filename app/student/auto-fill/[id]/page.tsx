import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { outstandingSummary } from '@/components/student/auto-fill/status';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { AlertTriangle, ArrowLeft, Download, Edit, FileText } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { getJob } from '@/services/auto-fill';

export const metadata: Metadata = { title: 'Your filled forms' };

export default async function AutoFillResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { studentProfileId } = await requireOnboardedStudent();
  const { id } = await params;
  const job = await getJob(id, studentProfileId);
  if (!job) notFound();

  const completed = job.targetForms.filter((form) => form.status === 'COMPLETED');
  const failed = job.targetForms.filter((form) => form.status === 'FAILED');
  const totalFields = completed.reduce((n, form) => n + form.fieldsTotal, 0);
  const totalFilled = completed.reduce((n, form) => n + form.fieldsFilled, 0);
  const totalToConfirm = completed.reduce((n, form) => n + form.fieldsToConfirm, 0);
  const totalOutstanding = completed.reduce((n, form) => n + form.fieldsOutstanding, 0);
  // Progress is measured by fields that carry an answer, including the ones
  // awaiting confirmation: those are work done, not work outstanding.
  const totalAnswered = totalFilled + totalToConfirm;
  const stillBlank = totalOutstanding - totalToConfirm;

  return (
    <PageBody>
      <Link
        href="/student/auto-fill"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Auto-fill
      </Link>

      <PageHeader
        title="Your filled forms"
        description={`Read from ${job.sourceFileName}. Check each form before you send it to a funder — you have the last word on every field.`}
      />

      {job.status === 'FAILED' && (
        <Alert tone="danger" title="We could not read your completed form">
          {job.failureReason ??
            'That PDF could not be read, so none of your other forms could be filled in.'}{' '}
          <Link href="/student/auto-fill" className="font-semibold underline">
            Try another file
          </Link>
          .
        </Alert>
      )}

      {job.status === 'COMPLETED' && completed.length > 0 && (
        <>
          <Card className="mb-5">
            <CardBody>
              <ProgressBar
                value={totalFields === 0 ? 0 : (totalAnswered / totalFields) * 100}
                showLabel
                label={`${totalAnswered} of ${totalFields} fields have an answer across ${completed.length} form${completed.length === 1 ? '' : 's'}`}
                tone={totalOutstanding === 0 ? 'success' : 'brand'}
              />
              <p className="mt-3 text-[13px] text-ink-600">
                {totalOutstanding === 0
                  ? 'Every field we found has an answer. Read each form through before you submit it.'
                  : [
                      totalToConfirm > 0
                        ? `${totalToConfirm} field${totalToConfirm === 1 ? '' : 's'} need${totalToConfirm === 1 ? 's' : ''} checking`
                        : null,
                      stillBlank > 0
                        ? `${stillBlank} ${stillBlank === 1 ? 'is' : 'are'} still blank — signatures, documents to attach, and anything your completed form did not answer`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(', and ') + '.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <ButtonLink
                  href={`/api/student/auto-fill/${job.id}/download-all`}
                  leadingIcon={<Download className="h-[18px] w-[18px]" />}
                >
                  Download all as a ZIP
                </ButtonLink>
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-4">
            {completed.map((form) => (
              <Card key={form.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start gap-3">
                    <FileText className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {form.originalFileName}
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink-500">
                        {form.pageCount ?? 0} page{form.pageCount === 1 ? '' : 's'} ·{' '}
                        {outstandingSummary({
                          total: form.fieldsTotal,
                          filled: form.fieldsFilled,
                          toConfirm: form.fieldsToConfirm,
                          outstanding: form.fieldsOutstanding,
                        })}
                      </p>
                    </div>
                    <Badge tone={form.fieldsOutstanding === 0 ? 'success' : 'warning'}>
                      {form.fieldsOutstanding === 0
                        ? 'Nothing outstanding'
                        : 'Needs your attention'}
                    </Badge>
                  </div>

                  <ProgressBar
                    className="mt-3"
                    value={
                      form.fieldsTotal === 0
                        ? 0
                        : ((form.fieldsFilled + form.fieldsToConfirm) / form.fieldsTotal) * 100
                    }
                    tone={form.fieldsOutstanding === 0 ? 'success' : 'brand'}
                  />

                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <ButtonLink
                      href={`/student/auto-fill/${job.id}/forms/${form.id}`}
                      variant="outline"
                      size="sm"
                      leadingIcon={<Edit className="h-4 w-4" />}
                    >
                      Review and edit
                    </ButtonLink>
                    <ButtonLink
                      href={`/api/student/auto-fill/forms/${form.id}/download`}
                      variant="outline"
                      size="sm"
                      leadingIcon={<Download className="h-4 w-4" />}
                    >
                      Download PDF
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}

      {failed.length > 0 && (
        <Card className="mt-5 border-warning-100">
          <CardHeader
            title={`${failed.length} form${failed.length === 1 ? '' : 's'} could not be filled in`}
            description="The rest of your forms were not affected."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {failed.map((form) => (
                <li key={form.id} className="flex gap-3 px-5 py-3.5">
                  <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning-600" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{form.originalFileName}</p>
                    <p className="text-[13px] text-ink-600">
                      {form.failureReason ?? 'This form could not be read.'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {job.status === 'COMPLETED' && (
        <Card className="mt-5">
          <CardHeader
            title="What we read from your completed form"
            description={`${job.extractedValues.length} pieces of information, each traced back to where it came from.`}
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {job.extractedValues.map((value) => (
                <li
                  key={value.canonicalKey}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-2.5"
                >
                  <span className="text-[13px] font-medium text-ink-600">{value.canonicalKey}</span>
                  <span className="text-sm text-ink">{value.raw}</span>
                  <span className="ml-auto text-2xs text-ink-400">
                    {value.sourceFieldLabel}
                    {value.sourcePage ? ` · page ${value.sourcePage}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </PageBody>
  );
}
