import { AlertTriangle, Check, X } from '@/components/icons';
import { MatchBadge, MatchClassificationBadge } from '@/components/ui/badge';
import type { CriterionResult, MatchResult } from '@/lib/matching';
import { cn } from '@/lib/utils';

/**
 * "Why this match?"
 *
 * A percentage on its own is not trustworthy, so every score is shown with the
 * criteria behind it: what was met, what was not, and what still needs
 * verification. This is the same breakdown funders see on an applicant.
 */
export function MatchExplanation({
  match,
  title = 'Why you match',
  showScore = true,
  className,
}: {
  match: MatchResult;
  title?: string;
  showScore?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-card border border-line bg-white p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {showScore && (
          <div className="flex items-center gap-2">
            <MatchBadge score={match.matchScore} classification={match.classification} />
            <MatchClassificationBadge classification={match.classification} />
          </div>
        )}
      </div>

      <ul className="mt-4 space-y-2.5">
        {match.criteria.map((criterion) => (
          <CriterionRow key={`${criterion.key}-${criterion.label}`} criterion={criterion} />
        ))}
      </ul>

      {match.needsMoreInformation && (
        <p className="mt-4 rounded-field bg-warning-50 px-3.5 py-3 text-[13px] leading-5 text-warning-700">
          Some information is still missing from your profile. Completing it will give you a more
          accurate match and fewer questions from funders.
        </p>
      )}
    </div>
  );
}

export function CriterionRow({ criterion }: { criterion: CriterionResult }) {
  const config = {
    MET: {
      icon: <Check className="h-3.5 w-3.5" strokeWidth={2.8} />,
      wrap: 'bg-success-50 text-success-600',
      text: 'text-ink-700',
    },
    NOT_MET: {
      icon: <X className="h-3.5 w-3.5" strokeWidth={2.8} />,
      wrap: 'bg-danger-50 text-danger-600',
      text: 'text-ink-600',
    },
    UNKNOWN: {
      icon: <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />,
      wrap: 'bg-warning-50 text-warning-600',
      text: 'text-ink-600',
    },
  }[criterion.status];

  return (
    <li className="flex items-start gap-2.5">
      <span className={cn('mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full', config.wrap)}>
        {config.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13px] leading-5', config.text)}>{criterion.reason}</span>
        {criterion.weight > 0 && (
          <span className="mt-0.5 block text-[11px] text-ink-300">
            {criterion.label} · worth {criterion.weight}%
          </span>
        )}
      </span>
    </li>
  );
}

/** Compact checklist used inside cards where the full breakdown is too heavy. */
export function MatchReasonList({ reasons, className }: { reasons: string[]; className?: string }) {
  if (reasons.length === 0) return null;
  return (
    <ul className={cn('space-y-1.5', className)}>
      {reasons.map((reason) => (
        <li key={reason} className="flex items-start gap-2 text-[13px] text-ink-600">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-600" strokeWidth={2.6} />
          {reason}
        </li>
      ))}
    </ul>
  );
}
