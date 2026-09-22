import type { CanonicalKey, ValueKind } from './profile';
import { CANONICAL_KINDS } from './profile';

/**
 * Value handling.
 *
 * Normalising turns what the source said into one canonical form; formatting
 * turns that back into what a particular target field expects. Both are
 * meaning-preserving by design — a transformation that would change what the
 * value says is rejected rather than applied.
 */

export type NormaliseResult =
  | { ok: true; value: string; kind: ValueKind }
  | { ok: false; reason: string };

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/** Dates become ISO (YYYY-MM-DD). Ambiguous forms are refused, not guessed. */
export function normaliseDate(raw: string): NormaliseResult {
  const value = raw.trim();
  if (!value) return { ok: false, reason: 'Empty' };

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  if (iso) return isoOrFail(iso[1], iso[2], iso[3]);

  // South African forms are day-first. A value where both parts are 12 or less
  // is genuinely ambiguous between DD/MM and MM/DD only if it came from an
  // unknown locale; the source convention here is day-first, so it is applied
  // consistently rather than guessed per value.
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value);
  if (dmy) return isoOrFail(dmy[3], dmy[2], dmy[1]);

  const named = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(value);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (!month) return { ok: false, reason: `Unrecognised month "${named[2]}"` };
    return isoOrFail(named[3], month, named[1]);
  }

  return { ok: false, reason: `Unrecognised date format "${value}"` };
}

function isoOrFail(y: string, m: string, d: string): NormaliseResult {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false, reason: 'Date is out of range' };
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return { ok: false, reason: 'Date does not exist' };
  }
  return {
    ok: true,
    kind: 'date',
    value: `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

/** Phone numbers become digits only, with +27 reduced to a leading 0. */
export function normalisePhone(raw: string): NormaliseResult {
  const digits = raw.replace(/[^\d+]/g, '');
  let local = digits;
  if (local.startsWith('+27')) local = `0${local.slice(3)}`;
  else if (local.startsWith('27') && local.length === 11) local = `0${local.slice(2)}`;
  local = local.replace(/\D/g, '');
  if (local.length < 9 || local.length > 11) {
    return { ok: false, reason: `"${raw}" is not a recognisable phone number` };
  }
  return { ok: true, kind: 'text', value: local };
}

const TRUE_WORDS = ['yes', 'y', 'true', 'checked', 'x', '1'];
const FALSE_WORDS = ['no', 'n', 'false', 'unchecked', '0'];

export function normaliseBoolean(raw: string): NormaliseResult {
  const v = raw.trim().toLowerCase();
  if (TRUE_WORDS.includes(v)) return { ok: true, kind: 'boolean', value: 'true' };
  if (FALSE_WORDS.includes(v)) return { ok: true, kind: 'boolean', value: 'false' };
  return { ok: false, reason: `"${raw}" is not a yes or no answer` };
}

export function normaliseNumber(raw: string): NormaliseResult {
  const cleaned = raw.replace(/[R\s,]/g, '').replace(/%$/, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { ok: false, reason: `"${raw}" is not a number` };
  }
  return { ok: true, kind: 'number', value: cleaned };
}

/** Normalise according to the canonical key's declared kind. */
export function normaliseFor(key: CanonicalKey, raw: string): NormaliseResult {
  const value = raw.trim();
  if (!value) return { ok: false, reason: 'Empty' };

  switch (CANONICAL_KINDS[key]) {
    case 'date':
      return normaliseDate(value);
    case 'boolean':
      return normaliseBoolean(value);
    case 'number':
      return normaliseNumber(value);
    default:
      if (key === 'mobile' || key === 'alternatePhone') return normalisePhone(value);
      return { ok: true, kind: CANONICAL_KINDS[key], value: value.replace(/\s+/g, ' ') };
  }
}

/** Render a canonical value for a text field, in the form a reader expects. */
export function formatForDisplay(key: CanonicalKey, value: string): string {
  if (CANONICAL_KINDS[key] === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  if (key === 'mobile' || key === 'alternatePhone') {
    const m = /^(\d{3})(\d{3})(\d{4})$/.exec(value);
    if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  }
  if (CANONICAL_KINDS[key] === 'boolean') return value === 'true' ? 'Yes' : 'No';
  return value;
}

/**
 * Choose the option on a target field that matches a canonical value.
 * Returns null when nothing matches — the field is then left alone.
 */
export function chooseOption(value: string, options: string[]): string | null {
  const v = value.trim().toLowerCase();
  const exact = options.find((o) => o.trim().toLowerCase() === v);
  if (exact) return exact;

  if (v === 'true' || v === 'false') {
    const want = v === 'true' ? ['yes', 'y', 'true', 'on'] : ['no', 'n', 'false', 'off'];
    const hit = options.find((o) => want.includes(o.trim().toLowerCase()));
    if (hit) return hit;
  }

  const partial = options.filter((o) => {
    const ov = o.trim().toLowerCase();
    return ov.startsWith(v) || v.startsWith(ov);
  });
  return partial.length === 1 ? partial[0] : null;
}
