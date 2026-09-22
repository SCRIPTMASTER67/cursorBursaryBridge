import { analyseDocument, type DocumentAnalysis } from './extract';
import { fillTarget } from './fill';
import { mapFields, summarise, type MappedField } from './map';
import type { MatcherProvider } from './match';
import { defaultMatcher } from './match';
import type { StudentProfileData } from './profile';
import { readSourceForm } from './source';
import { validateMapping, type FillProblem, type ValidationIssue } from './validate';

/**
 * Running one job end to end.
 *
 * The source form is read once into a canonical profile, then each target form
 * is processed on its own: analysed, mapped, filled, validated, summarised. A
 * target that cannot be processed fails alone — it is recorded as FAILED with
 * a reason and the rest of the batch continues, because a student who uploaded
 * eight forms should get the seven that worked.
 */

export type TargetInput = {
  /** Stable identifier used to match a result back to its upload. */
  id: string;
  documentName: string;
  bytes: Uint8Array;
};

export type TargetSuccess = {
  id: string;
  documentName: string;
  ok: true;
  fields: MappedField[];
  issues: ValidationIssue[];
  summary: ReturnType<typeof summarise>;
  analysis: DocumentAnalysis;
  /** The populated PDF. Bytes, not a preview — this is what the student downloads. */
  bytes: Uint8Array;
};

export type TargetFailure = {
  id: string;
  documentName: string;
  ok: false;
  reason: string;
  analysis: DocumentAnalysis | null;
};

export type TargetResult = TargetSuccess | TargetFailure;

export type PipelineResult =
  | {
      ok: false;
      /** The source could not be read, so no target could be attempted. */
      reason: string;
      sourceAnalysis: DocumentAnalysis | null;
    }
  | {
      ok: true;
      profile: StudentProfileData;
      sourceAnalysis: DocumentAnalysis;
      matcher: string;
      results: TargetResult[];
      overall: {
        targetsTotal: number;
        targetsProcessed: number;
        targetsFailed: number;
        fieldsTotal: number;
        fieldsFilled: number;
        fieldsOutstanding: number;
        /** Across every processed form. Floored, so it never reads 100 while anything is outstanding. */
        populatedPercent: number;
      };
    };

export type PipelineOptions = {
  matcher?: MatcherProvider;
  /** Called after each target so the UI can show real progress, not a fake timer. */
  onProgress?: (done: number, total: number, documentName: string) => void;
};

export async function runPipeline(
  source: { documentName: string; bytes: Uint8Array },
  targets: TargetInput[],
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const matcher = options.matcher ?? defaultMatcher;

  const read = await readSourceForm(source.bytes, source.documentName, { matcher });
  if (!read.ok) {
    return { ok: false, reason: read.reason, sourceAnalysis: read.analysis };
  }

  const results: TargetResult[] = [];
  for (const [index, target] of targets.entries()) {
    results.push(await processTarget(target, read.profile, matcher));
    options.onProgress?.(index + 1, targets.length, target.documentName);
  }

  const processed = results.filter((r): r is TargetSuccess => r.ok);
  const fieldsTotal = processed.reduce((n, r) => n + r.summary.total, 0);
  const fieldsFilled = processed.reduce((n, r) => n + r.summary.filled, 0);
  const fieldsOutstanding = processed.reduce((n, r) => n + r.summary.outstanding, 0);

  return {
    ok: true,
    profile: read.profile,
    sourceAnalysis: read.analysis,
    matcher: matcher.name,
    results,
    overall: {
      targetsTotal: targets.length,
      targetsProcessed: processed.length,
      targetsFailed: results.length - processed.length,
      fieldsTotal,
      fieldsFilled,
      fieldsOutstanding,
      populatedPercent: fieldsTotal === 0 ? 0 : Math.floor((fieldsFilled / fieldsTotal) * 100),
    },
  };
}

/** One target form. Every failure path returns rather than throws, so the batch survives it. */
async function processTarget(
  target: TargetInput,
  profile: StudentProfileData,
  matcher: MatcherProvider,
): Promise<TargetResult> {
  const fail = (reason: string, analysis: DocumentAnalysis | null): TargetFailure => ({
    id: target.id,
    documentName: target.documentName,
    ok: false,
    reason,
    analysis,
  });

  let analysis: DocumentAnalysis;
  try {
    analysis = await analyseDocument(target.bytes);
  } catch (error) {
    console.error(`[auto-fill] target "${target.documentName}" could not be analysed`, error);
    return fail(
      'This PDF could not be opened. It may be damaged or in an unsupported format.',
      null,
    );
  }

  if (analysis.encrypted) {
    return fail('This PDF is password protected. Please upload an unlocked copy.', analysis);
  }
  if (analysis.likelyScanned) {
    return fail(
      'We could not find any fields or text in this form. It looks like a scan, so we cannot tell where the answers go. Please upload a digital copy.',
      analysis,
    );
  }
  if (analysis.fields.length === 0) {
    return fail(
      'No fields could be found on this form, so there was nothing to fill in.',
      analysis,
    );
  }

  const mapped = mapFields(analysis.fields, profile, { matcher });

  // Validation runs before the write, not after it. A value the checks reject
  // must never reach the PDF: a page that disagrees with the review panel is
  // the same wrong-value failure this feature exists to avoid.
  const checked = validateMapping(mapped, profile, new Map<string, FillProblem>());

  let filled: Awaited<ReturnType<typeof fillTarget>>;
  try {
    filled = await fillTarget(target.bytes, checked.fields);
  } catch (error) {
    console.error(`[auto-fill] target "${target.documentName}" could not be written to`, error);
    return fail('This form could not be written to. The original file is unchanged.', analysis);
  }

  // Anything the writer could not place legibly is flagged in a second pass,
  // so the field reads as needing attention rather than looking populated.
  const fillProblems = new Map<string, FillProblem>();
  for (const outcome of filled.outcomes) {
    if (outcome.problem) {
      fillProblems.set(outcome.targetFieldName, {
        message: outcome.problem,
        written: outcome.written,
      });
    }
  }
  const validated = validateMapping(checked.fields, profile, fillProblems);

  return {
    id: target.id,
    documentName: target.documentName,
    ok: true,
    fields: validated.fields,
    issues: [...checked.issues, ...validated.issues],
    summary: summarise(validated.fields),
    analysis,
    bytes: filled.bytes,
  };
}
