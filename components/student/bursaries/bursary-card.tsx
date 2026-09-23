import Link from 'next/link';
import type { DirectoryRow } from '@/services/bursary-directory';
import { BursaryStatusBadge } from './status-badge';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { OrgAvatar } from '@/components/ui/avatar';
import { ArrowRight, Calendar, FileText, ShieldCheck } from '@/components/icons';
import { STATUS_COPY, isOpenNow } from '@/lib/bursary-status';
import { fundingCoverageLabels, fundingTypeLabels } from '@/lib/labels';
import { deadlineLabel, formatDate } from '@/lib/utils';

/**
 * One opportunity in the directory.
 *
 * The card never offers to apply for something that is not open. A closed
 * bursary still earns its place — it says who funds what, and roughly when the
 * next cycle comes round — but the only thing it offers is a look at the
 * details.
 *
 * Everything on it comes from the stored record. Nothing is filled in to make
 * the card look complete.
 */
export function BursaryCard({ row }: { row: DirectoryRow }) {
  const courses = row.supportedProgrammes.map((p) => p.programme.name);
  const closed = row.status === 'CLOSED';
  const deadline = row.deadlineKind === 'FIXED' ? deadlineLabel(row.closingDate) : null;

  return (
    <article
      className={
        'flex flex-col rounded-card border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-elevated ' +
        (closed ? 'opacity-90' : '')
      }
    >
      <div className="flex items-start gap-3">
        <OrgAvatar name={row.organisation.name} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
            {row.name}
          </h3>
          <p className="truncate text-[13px] text-ink-500">{row.organisation.name}</p>
        </div>
        <BursaryStatusBadge status={row.status} />
      </div>

      {row.shortDescription && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-600">{row.shortDescription}</p>
      )}

      <dl className="mt-3.5 grid gap-1.5 text-[13px]">
        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <dt className="sr-only">Deadline</dt>
          <dd className="text-ink-700">
            {row.deadlineKind === 'ROLLING'
              ? 'Rolling applications'
              : row.deadlineKind === 'UNTIL_FILLED'
                ? 'Open until places are filled'
                : row.closingDate
                  ? `${formatDate(row.closingDate)}${deadline && !closed ? ` · ${deadline}` : ''}`
                  : (row.deadlineNote ?? 'Deadline not specified')}
          </dd>
        </div>

        {row.coverage.length > 0 && (
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            <dt className="sr-only">Funding covers</dt>
            <dd className="text-ink-700">
              {row.coverage.map((c) => fundingCoverageLabels[c]).join(', ')}
            </dd>
          </div>
        )}

        {row._count.applicationForms > 0 && (
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            <dt className="sr-only">Application form</dt>
            <dd className="text-ink-700">Official application form available</dd>
          </div>
        )}
      </dl>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <Badge tone="neutral">{fundingTypeLabels[row.fundingType]}</Badge>
        {courses.slice(0, 2).map((course) => (
          <Badge key={course} tone="neutral">
            {course}
          </Badge>
        ))}
        {courses.length > 2 && <Badge tone="neutral">+{courses.length - 2} more</Badge>}
      </div>

      {row.status === 'NEEDS_VERIFICATION' && (
        <p className="mt-3 rounded-field bg-warning-50 px-3 py-2 text-[13px] text-warning-700">
          {STATUS_COPY.NEEDS_VERIFICATION.meaning}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
        {/* Never "Apply now" on something that is not open. */}
        <ButtonLink
          href={`/student/bursaries/${row.slug}`}
          variant={isOpenNow(row.status) ? 'primary' : 'outline'}
          size="sm"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          {closed ? 'View details' : 'View bursary'}
        </ButtonLink>

        {closed && <span className="text-[13px] text-ink-500">Applications closed</span>}

        {row.sourceUrl && (
          <Link
            href={row.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="ml-auto text-[13px] font-medium text-ink-500 hover:text-brand-600"
          >
            {row.officialSource ? 'Official source' : (row.sourceName ?? 'Source')}
          </Link>
        )}
      </div>
    </article>
  );
}
