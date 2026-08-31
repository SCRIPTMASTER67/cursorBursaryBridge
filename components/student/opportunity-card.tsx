import Link from 'next/link';
import { Calendar, Check } from '@/components/icons';
import { Badge, MatchBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { fundingCoverageLabels } from '@/lib/labels';
import type { MatchResult } from '@/lib/matching';
import { cn, daysUntil, formatDate } from '@/lib/utils';
import type { ProgrammeWithRelations } from '@/services/matching';

/**
 * The opportunity card from the reference dashboard and opportunities list.
 *
 * Always shows WHY the student matches, never a bare percentage — the
 * reasons come straight from the matching engine's criterion results.
 */
export function OpportunityCard({
  programme,
  match,
  compact = false,
  applied = false,
}: {
  programme: ProgrammeWithRelations;
  match: MatchResult;
  compact?: boolean;
  applied?: boolean;
}) {
  const days = daysUntil(programme.closingDate);
  const closingSoon = days >= 0 && days <= 14;

  const courses = programme.supportedProgrammes.map((p) => p.programme.name);
  const institutions = programme.supportedInstitutions.map(
    (i) => i.institution.shortName ?? i.institution.name,
  );

  return (
    <article className="rounded-card border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-elevated">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug text-ink">
            <Link href={`/student/opportunities/${programme.id}`} className="hover:text-brand-700">
              {programme.name}
            </Link>
          </h3>
          <p className="mt-1 truncate text-[13px] text-ink-400">
            {courses.length > 0 ? courses.slice(0, 2).join(', ') : 'All courses'}
            {institutions.length > 0 && (
              <>
                <span className="mx-1.5 text-ink-300">·</span>
                {institutions.slice(0, 2).join(', ')}
                {institutions.length > 2 && ` +${institutions.length - 2}`}
              </>
            )}
          </p>
        </div>
        <MatchBadge score={match.matchScore} classification={match.classification} />
      </div>

      <p className="mt-1.5 text-[13px] font-medium text-ink-500">{programme.organisation.name}</p>

      {/* What the programme funds */}
      <ul className="mt-3.5 flex flex-wrap gap-1.5">
        {programme.coverage.slice(0, compact ? 3 : 5).map((item) => (
          <li key={item}>
            <Badge tone="neutral" icon={<Check className="h-3 w-3" strokeWidth={2.6} />}>
              {fundingCoverageLabels[item]}
            </Badge>
          </li>
        ))}
        {programme.coverage.length > (compact ? 3 : 5) && (
          <li>
            <Badge tone="neutral">+{programme.coverage.length - (compact ? 3 : 5)} more</Badge>
          </li>
        )}
      </ul>

      {!compact && match.reasons.length > 0 && (
        <div className="mt-4 rounded-field bg-surface-muted px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
            Why you match
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {match.reasons.slice(0, 4).map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-[13px] text-ink-600">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-600" strokeWidth={2.6} />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p
          className={cn(
            'flex items-center gap-1.5 text-[13px]',
            closingSoon ? 'font-medium text-warning-600' : 'text-ink-400',
          )}
        >
          <Calendar className="h-4 w-4" />
          Closes {formatDate(programme.closingDate)}
          {closingSoon && <span className="font-semibold">· {days === 0 ? 'today' : `${days} days left`}</span>}
        </p>

        {applied ? (
          <Badge tone="brand">Applied</Badge>
        ) : (
          <ButtonLink href={`/student/opportunities/${programme.id}`} size="sm" variant="secondary">
            View Opportunity
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
