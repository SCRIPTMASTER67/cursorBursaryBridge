/**
 * The one canonical catalogue.
 *
 * Institutions, courses and subjects are shared between student study
 * preferences, funder eligibility rules and the matching engine. If "Computer
 * Science" and "computer science" become two rows, a student who picks one and
 * a funder who names the other never meet, and the match silently fails. That
 * is what the canonical name prevents.
 */

/**
 * Reduce a name to the form that decides whether two entries are the same
 * thing: lower case, punctuation and accents removed, whitespace collapsed.
 *
 * Deliberately conservative. It collapses spelling noise — trailing spaces,
 * "St." against "St", an en dash against a hyphen — and nothing else. It does
 * not try to know that "UJ" is the University of Johannesburg, because
 * guessing that wrongly merges two real institutions into one.
 */
export function canonicalise(name: string): string {
  return (
    name
      .normalize('NFKD')
      // Strip combining accents so "Université" and "Universite" agree.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Tidy a name for storage: collapse whitespace, keep the author's casing. */
export function tidyName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** Whether a name is usable at all. */
export function isUsableName(name: string): boolean {
  const canonical = canonicalise(name);
  return canonical.length >= 2 && /[a-z]/.test(canonical);
}
