import type { DetectedField } from './extract';
import { defaultMatcher, type MatcherProvider } from './match';
import { chooseOption, formatForDisplay, normaliseFor } from './normalise';
import type { CanonicalKey, Confidence, StudentProfileData } from './profile';
import { CANONICAL_LABELS } from './profile';

/**
 * Deciding what goes where.
 *
 * Every target field ends in exactly one outcome, and the outcome is recorded
 * with its reason so the review panel can explain itself:
 *
 *   FILLED           a high-confidence match, populated
 *   NEEDS_REVIEW     populated, but the student is asked to confirm it
 *   MISSING          the source holds nothing for this field
 *   AMBIGUOUS        the label could mean more than one thing
 *   SIGNATURE        never automated
 *   MANUAL           a document upload or similar the form cannot supply
 *
 * Nothing is ever invented. A field with no evidence behind it stays empty.
 */

export type MappingStatus =
  | 'FILLED'
  | 'NEEDS_REVIEW'
  | 'MISSING'
  | 'AMBIGUOUS'
  | 'SIGNATURE'
  | 'MANUAL';

export type MappedField = {
  targetFieldName: string;
  targetLabel: string;
  kind: DetectedField['kind'];
  page: number;
  rect: DetectedField['rect'];
  options?: string[];
  status: MappingStatus;
  /** The value to write. Null whenever nothing is written. */
  value: string | null;
  canonicalKey: CanonicalKey | null;
  confidence: Confidence | null;
  /** Why this outcome was reached, in words a student can read. */
  reason: string;
  provenance: {
    documentName: string;
    page: number | null;
    fieldLabel: string;
  } | null;
};

/** A document requirement stated on the form, which no source form can satisfy. */
function looksLikeDocumentRequest(label: string): boolean {
  return /\battach|\bcertified copy|\bupload|\bproof of\b|\btranscript\b|\bcertificate\b/i.test(
    label,
  );
}

export function mapFields(
  targetFields: DetectedField[],
  profile: StudentProfileData,
  options: { matcher?: MatcherProvider } = {},
): MappedField[] {
  const matcher = options.matcher ?? defaultMatcher;

  return targetFields.map((field): MappedField => {
    const base = {
      targetFieldName: field.name,
      targetLabel: field.label,
      kind: field.kind,
      page: field.page,
      rect: field.rect,
      options: field.options,
    };

    if (field.kind === 'signature') {
      return {
        ...base,
        status: 'SIGNATURE',
        value: null,
        canonicalKey: null,
        confidence: null,
        reason: 'Signature required. This must be signed by you.',
        provenance: null,
      };
    }

    if (looksLikeDocumentRequest(field.label)) {
      return {
        ...base,
        status: 'MANUAL',
        value: null,
        canonicalKey: null,
        confidence: null,
        reason: 'Additional document required. Attach this yourself.',
        provenance: null,
      };
    }

    const match = matcher.match(field.label);

    if (!match.key || !match.confidence) {
      return {
        ...base,
        status: 'AMBIGUOUS',
        value: null,
        canonicalKey: null,
        confidence: null,
        reason: match.reason,
        provenance: null,
      };
    }

    const held = profile.values[match.key];
    if (!held) {
      return {
        ...base,
        status: 'MISSING',
        value: null,
        canonicalKey: match.key,
        confidence: null,
        reason: `Information required. Your completed form does not contain a ${CANONICAL_LABELS[match.key].toLowerCase()}.`,
        provenance: null,
      };
    }

    // A weak label match is not enough to write anything, even when the source
    // holds the value: the risk is putting the right value in the wrong box.
    if (match.confidence === 'LOW') {
      return {
        ...base,
        status: 'AMBIGUOUS',
        value: null,
        canonicalKey: match.key,
        confidence: 'LOW',
        reason: `Not confident this field means "${CANONICAL_LABELS[match.key]}". ${match.reason}.`,
        provenance: null,
      };
    }

    // Choice-style fields need an option that actually exists on this form.
    let write: string | null;
    if (field.kind === 'checkbox') {
      const asBool = held.value === 'true' ? 'true' : held.value === 'false' ? 'false' : null;
      if (asBool === null) {
        return {
          ...base,
          status: 'NEEDS_REVIEW',
          value: null,
          canonicalKey: match.key,
          confidence: 'LOW',
          reason: 'Your answer could not be read as a yes or no, so nothing was ticked.',
          provenance: null,
        };
      }
      write = asBool;
    } else if (field.kind === 'radio' || field.kind === 'dropdown') {
      const chosen = chooseOption(formatForDisplay(match.key, held.value), field.options ?? []);
      if (!chosen) {
        return {
          ...base,
          status: 'NEEDS_REVIEW',
          value: null,
          canonicalKey: match.key,
          confidence: 'LOW',
          reason: `None of this form's options match "${formatForDisplay(match.key, held.value)}".`,
          provenance: null,
        };
      }
      write = chosen;
    } else {
      write = formatForDisplay(match.key, held.value);
    }

    // The weaker of the two confidences governs: a perfect label match on a
    // value read uncertainly is still uncertain. A target field whose position
    // was inferred from the printed layout rather than read from a real form
    // field is never certain either — the value may be right while the place
    // it lands on the page is not — so it is capped and shown for confirmation.
    const placement: Confidence = field.source === 'text-layout' ? 'MEDIUM' : 'HIGH';
    const effective = weakest(weakest(match.confidence, held.confidence), placement);

    return {
      ...base,
      status: effective === 'HIGH' ? 'FILLED' : 'NEEDS_REVIEW',
      value: write,
      canonicalKey: match.key,
      confidence: effective,
      reason:
        effective === 'HIGH'
          ? `Matched to ${CANONICAL_LABELS[match.key]} from your completed form.`
          : field.source === 'text-layout' && weakest(match.confidence, held.confidence) === 'HIGH'
            ? `Matched to ${CANONICAL_LABELS[match.key]}. This form has no fillable fields, so check the text has landed in the right place.`
            : `Matched to ${CANONICAL_LABELS[match.key]}, but please confirm. ${match.reason}.`,
      provenance: {
        documentName: held.provenance.documentName,
        page: held.provenance.page,
        fieldLabel: held.provenance.fieldLabel,
      },
    };
  });
}

const ORDER: Confidence[] = ['LOW', 'MEDIUM', 'HIGH'];
function weakest(a: Confidence, b: Confidence): Confidence {
  return ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b;
}

/** Counts for the results page. Processing finishing is not the same as a form being complete. */
export function summarise(fields: MappedField[]) {
  const total = fields.length;
  const filled = fields.filter((f) => f.status === 'FILLED').length;
  const needsReview = fields.filter((f) => f.status === 'NEEDS_REVIEW').length;
  const missing = fields.filter((f) => f.status === 'MISSING').length;
  const ambiguous = fields.filter((f) => f.status === 'AMBIGUOUS').length;
  const signature = fields.filter((f) => f.status === 'SIGNATURE').length;
  const manual = fields.filter((f) => f.status === 'MANUAL').length;
  const outstanding = needsReview + missing + ambiguous + signature + manual;
  return {
    total,
    filled,
    needsReview,
    missing,
    ambiguous,
    signature,
    manual,
    outstanding,
    /** Share of fields populated without needing the student — never rounded up to 100. */
    populatedPercent: total === 0 ? 0 : Math.floor((filled / total) * 100),
    readyToSubmit: outstanding === 0,
  };
}
