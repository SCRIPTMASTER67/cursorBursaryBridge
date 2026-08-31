import type { ReactNode } from 'react';
import type { ApplicationStatus, MatchClassification, ProgrammeStatus, ShortlistStatus } from '@prisma/client';
import {
  applicationStatusLabels,
  matchClassificationLabels,
  programmeStatusLabels,
  shortlistStatusLabels,
} from '@/lib/labels';
import type { EligibilityOutcome } from '@/lib/matching';
import { eligibilityOutcomeLabels } from '@/lib/matching';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-ink-600 ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  success: 'bg-success-50 text-success-600 ring-success-100',
  warning: 'bg-warning-50 text-warning-600 ring-warning-100',
  danger: 'bg-danger-50 text-danger-600 ring-danger-100',
  info: 'bg-info-50 text-info-600 ring-info-100',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Status colour is derived from the status itself, never passed in by callers. */
const applicationTones: Record<ApplicationStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  DOCUMENTS_REQUIRED: 'warning',
  SHORTLISTED: 'brand',
  APPROVED: 'success',
  UNSUCCESSFUL: 'danger',
};

export function ApplicationStatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <Badge tone={applicationTones[status]} className={className}>
      {applicationStatusLabels[status]}
    </Badge>
  );
}

const programmeTones: Record<ProgrammeStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  CLOSED: 'danger',
};

export function ProgrammeStatusBadge({ status, className }: { status: ProgrammeStatus; className?: string }) {
  return (
    <Badge tone={programmeTones[status]} className={className}>
      {programmeStatusLabels[status]}
    </Badge>
  );
}

const eligibilityTones: Record<EligibilityOutcome, BadgeTone> = {
  ELIGIBLE: 'success',
  NOT_ELIGIBLE: 'danger',
  PENDING_VERIFICATION: 'warning',
};

export function EligibilityBadge({ outcome, className }: { outcome: EligibilityOutcome; className?: string }) {
  return (
    <Badge tone={eligibilityTones[outcome]} className={className}>
      {eligibilityOutcomeLabels[outcome]}
    </Badge>
  );
}

const shortlistTones: Record<ShortlistStatus, BadgeTone> = {
  SHORTLISTED: 'brand',
  SELECTED: 'success',
  WITHDRAWN: 'neutral',
};

export function ShortlistStatusBadge({ status, className }: { status: ShortlistStatus; className?: string }) {
  return (
    <Badge tone={shortlistTones[status]} className={className}>
      {shortlistStatusLabels[status]}
    </Badge>
  );
}

/**
 * The green "94% Match" pill from the reference designs. A weaker match is
 * toned down rather than hidden, so the score is always honest.
 */
export function MatchBadge({
  score,
  classification,
  className,
  size = 'md',
}: {
  score: number;
  classification?: MatchClassification;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const tone: BadgeTone =
    classification === 'STRONG_MATCH' || score >= 85
      ? 'success'
      : classification === 'POTENTIAL_MATCH' || score >= 60
        ? 'brand'
        : 'warning';

  return (
    <Badge
      tone={tone}
      className={cn(size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1', 'tabular-nums', className)}
    >
      {score}% Match
    </Badge>
  );
}

export function MatchClassificationBadge({
  classification,
  className,
}: {
  classification: MatchClassification;
  className?: string;
}) {
  const tone: BadgeTone =
    classification === 'STRONG_MATCH' ? 'success' : classification === 'POTENTIAL_MATCH' ? 'brand' : 'warning';
  return (
    <Badge tone={tone} className={className}>
      {matchClassificationLabels[classification]}
    </Badge>
  );
}
