import { analyseDocument, type DocumentAnalysis } from './extract';
import { defaultMatcher, type MatcherProvider } from './match';
import { normaliseFor } from './normalise';
import type { CanonicalValue, Confidence, StudentProfileData } from './profile';

/**
 * Reading the student's completed form into the canonical profile.
 *
 * Where a value comes from decides how much it is trusted. A value read out of
 * a real form field is exact; a value recovered from a text layer was inferred
 * from position and is trusted less. A form with neither is not read at all —
 * it is reported as unreadable, because guessing at a scan is precisely the
 * failure this feature must not have.
 */

export type SourceReadResult =
  | { ok: true; profile: StudentProfileData; analysis: DocumentAnalysis }
  | { ok: false; reason: string; analysis: DocumentAnalysis | null };

export async function readSourceForm(
  bytes: Uint8Array,
  documentName: string,
  options: { matcher?: MatcherProvider } = {},
): Promise<SourceReadResult> {
  const matcher = options.matcher ?? defaultMatcher;

  let analysis: DocumentAnalysis;
  try {
    analysis = await analyseDocument(bytes);
  } catch (error) {
    return {
      ok: false,
      reason: 'This PDF could not be opened. It may be damaged or in an unsupported format.',
      analysis: null,
    };
  }

  if (analysis.encrypted) {
    return {
      ok: false,
      reason: 'This PDF is password protected. Please provide an unlocked copy.',
      analysis,
    };
  }

  if (analysis.likelyScanned) {
    return {
      ok: false,
      reason:
        'We could not read any text in this form. It looks like a scan or a photograph, which we cannot read reliably. Please upload a digital copy.',
      analysis,
    };
  }

  const values: StudentProfileData['values'] = {};
  const unmapped: StudentProfileData['unmapped'] = [];

  for (const field of analysis.fields) {
    const raw = (field.value ?? '').trim();
    if (!raw) continue;
    if (field.kind === 'signature') continue;

    const match = matcher.match(field.label);
    if (!match.key || !match.confidence || match.confidence === 'LOW') {
      unmapped.push({ label: field.label, value: raw, page: field.page });
      continue;
    }

    const normalised = normaliseFor(match.key, raw);
    if (!normalised.ok) {
      // The label was understood but the value was not. Recording it as
      // unmapped keeps it visible without letting it reach a target form.
      unmapped.push({ label: field.label, value: raw, page: field.page });
      continue;
    }

    const readConfidence: Confidence = field.source === 'acroform' ? 'HIGH' : 'MEDIUM';
    const confidence = weakest(match.confidence, readConfidence);

    const candidate: CanonicalValue = {
      key: match.key,
      kind: normalised.kind,
      value: normalised.value,
      raw,
      confidence,
      provenance: {
        documentName,
        page: field.page,
        fieldLabel: field.label,
        method: field.source === 'acroform' ? 'acroform' : 'text-layout',
      },
    };

    // When the same information appears twice, keep the more trusted reading.
    const existing = values[match.key];
    if (!existing || rank(candidate.confidence) > rank(existing.confidence)) {
      values[match.key] = candidate;
    }
  }

  deriveComposites(values);

  return { ok: true, profile: { values, unmapped }, analysis };
}

/**
 * Fill in what follows unavoidably from what was read.
 *
 * Joining a first name and a surname into a full name adds no information: the
 * form stated both, and there is only one way to put them together. The reverse
 * is not done. Splitting "Nomvula Precious Mthembu" back into a first name and
 * a surname requires deciding which word is which, and that is a guess — so a
 * source that gives only a full name leaves the separate fields empty.
 */
function deriveComposites(values: StudentProfileData['values']) {
  const first = values.firstName;
  const last = values.lastName;
  if (!values.fullName && first && last) {
    const value = `${first.value} ${last.value}`.replace(/\s+/g, ' ').trim();
    values.fullName = {
      key: 'fullName',
      kind: 'text',
      value,
      raw: value,
      confidence: weakest(first.confidence, last.confidence),
      provenance: {
        documentName: first.provenance.documentName,
        page: first.provenance.page,
        fieldLabel: `${first.provenance.fieldLabel} + ${last.provenance.fieldLabel}`,
        method: first.provenance.method,
      },
    };
  }
}

const ORDER: Confidence[] = ['LOW', 'MEDIUM', 'HIGH'];
const rank = (c: Confidence) => ORDER.indexOf(c);
const weakest = (a: Confidence, b: Confidence): Confidence => (rank(a) <= rank(b) ? a : b);
