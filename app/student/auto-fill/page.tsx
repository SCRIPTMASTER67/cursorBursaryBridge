import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { AutoFillStart } from '@/components/student/auto-fill/start';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ChevronRight, Sparkles } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { listJobs } from '@/services/auto-fill';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Auto-Fill Bursary Forms' };

export default async function AutoFillPage() {
  const { studentProfileId } = await requireOnboardedStudent();
  const jobs = await listJobs(studentProfileId);

  return (
    <PageBody>
      <PageHeader
        title="Auto-Fill Bursary Forms"
        description="Upload one bursary form you have already completed, then the blank ones you still have to fill in. We copy across what the forms have in common and show you exactly what we filled in, what we were unsure about, and what is still yours to answer."
      />

      <Card className="mb-5 border-brand-100 bg-brand-50">
        <CardBody className="flex gap-3">
          <Sparkles className="h-[18px] w-[18px] shrink-0 text-brand-600" />
          <div className="text-[13px] text-ink-700">
            <p className="font-semibold text-ink">We never guess your details.</p>
            <p className="mt-1">
              If a field is unclear, or your completed form does not answer it, we leave it blank
              and tell you why. Signatures are always yours to add. You review every form before you
              download it.
            </p>
          </div>
        </CardBody>
      </Card>

      <AutoFillStart />

      {jobs.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Earlier runs" />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/student/auto-fill/${job.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-subtle"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{job.sourceFileName}</p>
                      <p className="text-[13px] text-ink-500">
                        {job._count.targetForms} form{job._count.targetForms === 1 ? '' : 's'} ·{' '}
                        {formatDate(job.createdAt)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        job.status === 'COMPLETED'
                          ? 'success'
                          : job.status === 'FAILED'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {job.status === 'COMPLETED'
                        ? 'Ready'
                        : job.status === 'FAILED'
                          ? 'Could not be read'
                          : job.status === 'PROCESSING'
                            ? 'Running'
                            : 'Not started'}
                    </Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </PageBody>
  );
}
