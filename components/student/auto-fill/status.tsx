import type { AutoFillFieldStatus } from '@prisma/client';
import { Badge, type BadgeTone } from '@/components/ui/badge';

/**
 * How each outcome is described to the student.
 *
 * The wording is deliberately plain about what was and was not done. A field
 * we left blank is not a failure to hide — it is the system saying it did not
 * know, which is the whole point of the feature.
 */
export const FIELD_STATUS: Record<
  AutoFillFieldStatus,
  { label: string; tone: BadgeTone; meaning: string }
> = {
  FILLED: {
    label: 'Filled in',
    tone: 'success',
    meaning: 'Taken from your completed form.',
  },
  NEEDS_REVIEW: {
    label: 'Check this',
    tone: 'warning',
    meaning: 'We filled this in but were not certain. Please confirm it before you submit.',
  },
  MISSING: {
    label: 'You need to add this',
    tone: 'neutral',
    meaning: 'Your completed form does not answer this question.',
  },
  AMBIGUOUS: {
    label: 'We were not sure',
    tone: 'neutral',
    meaning: 'We could not tell what this field is asking for, so we left it for you.',
  },
  SIGNATURE: {
    label: 'Sign yourself',
    tone: 'info',
    meaning: 'Signatures are never filled in for you.',
  },
  MANUAL: {
    label: 'Attach a document',
    tone: 'info',
    meaning: 'This asks for a document, which you will need to attach yourself.',
  },
};

export function FieldStatusBadge({ status }: { status: AutoFillFieldStatus }) {
  const config = FIELD_STATUS[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

/**
 * Shared counts wording, so the results and review screens never disagree.
 *
 * "Has an answer" and "is settled" are reported separately on purpose. A form
 * where every field carries a value but each one needs confirming is not the
 * same as an empty one, and telling a student "0 filled in" while they are
 * looking at a page full of their own details would be plainly wrong.
 */
export function outstandingSummary(counts: {
  total: number;
  filled: number;
  toConfirm: number;
  outstanding: number;
}): string {
  const { total, filled, toConfirm, outstanding } = counts;
  if (total === 0) return 'No fields were found on this form.';

  const answered = filled + toConfirm;
  if (outstanding === 0) return `All ${total} fields are filled in.`;

  const parts = [
    `${answered} of ${total} ${answered === 1 ? 'field has' : 'fields have'} an answer`,
  ];
  if (toConfirm > 0) parts.push(`${toConfirm} to check`);
  const stillBlank = outstanding - toConfirm;
  if (stillBlank > 0) parts.push(`${stillBlank} still ${stillBlank === 1 ? 'needs' : 'need'} you`);
  return `${parts.join(', ')}.`;
}
