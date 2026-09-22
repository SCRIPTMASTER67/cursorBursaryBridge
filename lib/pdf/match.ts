import { ALIASES, THIRD_PARTY_MARKERS } from './aliases';
import type { CanonicalKey, Confidence } from './profile';

/**
 * Label matching.
 *
 * Turns a label found on a form ("Applicant's Surname", "Family Name") into a
 * canonical key, with a confidence level and a reason. The reason is kept so
 * the review panel can explain a decision rather than asserting it.
 *
 * The rule that matters: an uncertain match is never silently accepted. Only
 * HIGH survives automatic population; MEDIUM is populated but marked for
 * review; LOW and no-match populate nothing at all.
 */

export type MatchResult = {
  key: CanonicalKey | null;
  confidence: Confidence | null;
  reason: string;
};

/** Lower-case, strip punctuation and collapse whitespace. */
export function normaliseLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[*:_\-–—.,/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop a leading qualifier that only says the field is about the applicant. */
export function stripApplicantPrefix(normalised: string): string {
  return normalised.replace(
    /^(the\s+)?(applicants?|applicant s|students?|student s|candidates?|candidate s|learners?|learner s|your)\s+/,
    '',
  );
}

/** True when a label is asking about somebody other than the applicant. */
export function isThirdPartyLabel(label: string): boolean {
  const n = normaliseLabel(label);
  return THIRD_PARTY_MARKERS.some((marker) => n.includes(marker));
}

/**
 * The seam for a different matching strategy.
 *
 * The built-in implementation is a deterministic dictionary. A model-backed
 * matcher can be supplied instead without the pipeline changing, provided it
 * returns the same shape and honours the same confidence contract.
 */
export interface MatcherProvider {
  readonly name: string;
  match(label: string): MatchResult;
}

export class DictionaryMatcher implements MatcherProvider {
  readonly name = 'dictionary-v1';

  match(label: string): MatchResult {
    if (!normaliseLabel(label)) return { key: null, confidence: null, reason: 'Empty label' };

    // A label about a parent, guardian or referee is never the applicant's own
    // information, however closely the rest of it reads like a match.
    if (isThirdPartyLabel(label)) {
      return {
        key: null,
        confidence: null,
        reason: 'Label refers to a third party, not the applicant',
      };
    }

    const n = normaliseLabel(label);
    const direct = this.matchNormalised(n);
    if (direct.confidence === 'HIGH') return direct;

    // Only as a fallback, and only once the third-party check has passed, is a
    // leading "Applicant" or "Student" dropped: on the applicant's own form it
    // states the default and nothing more, so "Applicant Full Name" should
    // match as exactly as "Full Name" does. Trying it second is what keeps
    // "Student Number" — where the word is part of the field's meaning —
    // matching on its own terms.
    const stripped = stripApplicantPrefix(n);
    if (stripped !== n) {
      const retry = this.matchNormalised(stripped);
      if (retry.confidence === 'HIGH') return retry;
    }
    return direct;
  }

  private matchNormalised(n: string): MatchResult {
    if (!n) return { key: null, confidence: null, reason: 'Empty label' };

    // 1. Exact phrase, after normalisation. Unambiguous.
    for (const entry of ALIASES) {
      if (entry.negative?.some((neg) => n.includes(neg))) continue;
      if (entry.exact.some((phrase) => n === phrase)) {
        return { key: entry.key, confidence: 'HIGH', reason: `Exact label match on "${n}"` };
      }
    }

    // 2. The label contains an exact phrase as a whole-word run. Still strong,
    //    but a longer label may carry a qualifier the dictionary cannot see.
    const containing: { key: CanonicalKey; phrase: string }[] = [];
    for (const entry of ALIASES) {
      if (entry.negative?.some((neg) => n.includes(neg))) continue;
      for (const phrase of entry.exact) {
        if (new RegExp(`(^|\\s)${escapeRegex(phrase)}(\\s|$)`).test(n)) {
          containing.push({ key: entry.key, phrase });
        }
      }
    }
    if (containing.length === 1) {
      const only = containing[0];
      return {
        key: only.key,
        confidence: n === only.phrase ? 'HIGH' : 'MEDIUM',
        reason: `Label contains "${only.phrase}"`,
      };
    }
    if (containing.length > 1) {
      // Prefer the longest phrase: "student number" beats "number".
      const sorted = [...containing].sort((a, b) => b.phrase.length - a.phrase.length);
      if (sorted[0].phrase.length > sorted[1].phrase.length) {
        return {
          key: sorted[0].key,
          confidence: 'MEDIUM',
          reason: `Best of ${containing.length} candidates: "${sorted[0].phrase}"`,
        };
      }
      return {
        key: null,
        confidence: null,
        reason: `Ambiguous: matches ${sorted.map((c) => c.key).join(', ')}`,
      };
    }

    // 3. Token overlap. Weak on its own, so it never rises above LOW, and LOW
    //    is not populated automatically.
    const words = new Set(n.split(' '));
    const tokenHits: CanonicalKey[] = [];
    for (const entry of ALIASES) {
      if (entry.negative?.some((neg) => n.includes(neg))) continue;
      if (entry.tokens?.some((t) => (t.includes(' ') ? n.includes(t) : words.has(t)))) {
        tokenHits.push(entry.key);
      }
    }
    if (tokenHits.length === 1) {
      return {
        key: tokenHits[0],
        confidence: 'LOW',
        reason: `Weak token match for ${tokenHits[0]}`,
      };
    }
    if (tokenHits.length > 1) {
      return {
        key: null,
        confidence: null,
        reason: `Ambiguous token match: ${tokenHits.join(', ')}`,
      };
    }

    return { key: null, confidence: null, reason: 'No candidate in the label vocabulary' };
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const defaultMatcher: MatcherProvider = new DictionaryMatcher();
