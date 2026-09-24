/**
 * Deciding who an imported application belongs to.
 *
 * Two questions, and they are not the same one:
 *
 *   - Is this applicant already a Bursary-Bridge student? If so the
 *     application should hang off their profile rather than creating a second,
 *     unconnected record of the same person.
 *   - Is this application one we already hold? A batch emailed twice, or a
 *     resubmission, should be flagged rather than silently doubling a funder's
 *     applicant count.
 *
 * Both are answered only on identifiers that identify. A South African ID
 * number does; an email address does; a name does not. "T Nkosi" matches a
 * great many people, and merging two of them would put one applicant's marks
 * and another's income on the same record in front of somebody deciding who to
 * fund. So a name match is never a match — at most it is a question put to the
 * reviewer.
 */

export type IdentitySignals = {
  idNumber: string | null;
  email: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  mobile: string | null;
};

/** Digits only, so spacing and dashes do not defeat a comparison. */
export function normaliseIdNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  // A South African ID is thirteen digits. Anything much shorter is not an
  // identifier, and matching on it would be worse than not matching at all.
  return digits.length >= 8 ? digits : null;
}

export function normaliseEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) ? trimmed : null;
}

/** Last nine digits, which is a South African number however it was written. */
export function normaliseMobile(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
}

export function normaliseName(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length >= 3 ? cleaned : null;
}

export type DuplicateVerdict =
  | { duplicate: false }
  | {
      duplicate: true;
      /** Shown to the reviewer verbatim, so the warning can be judged. */
      reason: string;
      /** How sure we are. Only `strong` is worth interrupting someone for. */
      strength: 'strong' | 'possible';
    };

/**
 * Compare two applications.
 *
 * Returns what matched, in words. A funder deciding whether to merge two
 * records needs to know whether it was the ID number or the fact that two
 * people share a surname — "possible duplicate" with no reason is an
 * instruction to guess.
 */
export function compareApplicants(a: IdentitySignals, b: IdentitySignals): DuplicateVerdict {
  const aId = normaliseIdNumber(a.idNumber);
  const bId = normaliseIdNumber(b.idNumber);
  if (aId && bId) {
    if (aId === bId) {
      return { duplicate: true, reason: 'The same ID number appears on both.', strength: 'strong' };
    }
    // Two different ID numbers settle it: whatever else matches, these are two
    // people, and no weaker signal should override that.
    return { duplicate: false };
  }

  const aEmail = normaliseEmail(a.email);
  const bEmail = normaliseEmail(b.email);
  if (aEmail && bEmail && aEmail === bEmail) {
    return {
      duplicate: true,
      reason: 'Both give the same email address.',
      strength: 'strong',
    };
  }

  const aName = normaliseName(a.fullName);
  const bName = normaliseName(b.fullName);
  const sameName = Boolean(aName && bName && aName === bName);

  if (sameName && a.dateOfBirth && b.dateOfBirth && a.dateOfBirth === b.dateOfBirth) {
    return {
      duplicate: true,
      reason: 'Same name and the same date of birth.',
      strength: 'strong',
    };
  }

  const aMobile = normaliseMobile(a.mobile);
  const bMobile = normaliseMobile(b.mobile);
  if (sameName && aMobile && bMobile && aMobile === bMobile) {
    return {
      duplicate: true,
      reason: 'Same name and the same phone number.',
      strength: 'strong',
    };
  }

  if (sameName) {
    return {
      duplicate: true,
      reason: 'The same name appears on both, and nothing else could be compared.',
      strength: 'possible',
    };
  }

  return { duplicate: false };
}

export type IdentityLookup = {
  byIdNumber: (idNumber: string) => Promise<string[]>;
  byEmail: (email: string) => Promise<string[]>;
};

export type IdentityOutcome =
  | { resolution: 'NONE' }
  | { resolution: 'ID_NUMBER' | 'EMAIL'; studentProfileId: string }
  | { resolution: 'AMBIGUOUS'; candidates: string[] };

/**
 * Find the Bursary-Bridge student this application belongs to, if any.
 *
 * Only verified identifiers are tried, strongest first, and more than one
 * match is AMBIGUOUS rather than a coin toss. A student who cannot be
 * identified gets an external applicant record — which is a correct outcome,
 * not a failure, and is far better than attaching one person's application to
 * another person's account.
 */
export async function resolveIdentity(
  signals: IdentitySignals,
  lookup: IdentityLookup,
): Promise<IdentityOutcome> {
  const idNumber = normaliseIdNumber(signals.idNumber);
  if (idNumber) {
    const matches = await lookup.byIdNumber(idNumber);
    if (matches.length === 1) return { resolution: 'ID_NUMBER', studentProfileId: matches[0] };
    if (matches.length > 1) return { resolution: 'AMBIGUOUS', candidates: matches };
  }

  const email = normaliseEmail(signals.email);
  if (email) {
    const matches = await lookup.byEmail(email);
    if (matches.length === 1) return { resolution: 'EMAIL', studentProfileId: matches[0] };
    if (matches.length > 1) return { resolution: 'AMBIGUOUS', candidates: matches };
  }

  return { resolution: 'NONE' };
}
