import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSourceForm, buildTargets, GROUND_TRUTH, THIRD_PARTY } from './fixtures/bursary-forms';
import type { Expectation } from './fixtures/bursary-forms';
import { runPipeline } from '../lib/pdf/pipeline';
import type { MappedField } from '../lib/pdf/map';
import { analyseDocument } from '../lib/pdf/extract';

/**
 * Accuracy harness.
 *
 * Each target field is compared against what a person reading the source form
 * would have written there. Three verdicts:
 *
 *   PASS             the engine did what it should have
 *   REVIEW REQUIRED  the engine was more cautious than necessary — a blank the
 *                    student has to fill in. A coverage gap, not a defect.
 *   FAIL             the engine wrote something it should not have, or wrote
 *                    the wrong value. This is the only outcome that can put a
 *                    false statement on a student's bursary application, so it
 *                    is the only one that fails the run.
 */

type Verdict = 'PASS' | 'REVIEW' | 'FAIL';

type Row = {
  form: string;
  label: string;
  verdict: Verdict;
  detail: string;
};

const OUT_DIR = join(process.cwd(), 'tmp', 'pdf-fixtures');

const POPULATED = new Set(['FILLED', 'NEEDS_REVIEW']);

/** Values that must never appear on any target form: they belong to somebody else. */
const FORBIDDEN = Object.values(THIRD_PARTY);

function judge(
  field: MappedField,
  expected: Expectation | undefined,
): { verdict: Verdict; detail: string } {
  if (!expected) {
    return { verdict: 'REVIEW', detail: `No expectation declared; engine said ${field.status}.` };
  }

  const wrote = field.value !== null;
  const shouldWrite = POPULATED.has(expected.status) && expected.expect !== undefined;

  // The worst case first: something was written that should not have been.
  if (wrote && !shouldWrite) {
    return {
      verdict: 'FAIL',
      detail: `Wrote "${field.value}" into a field that must stay blank. ${expected.because}`,
    };
  }

  if (wrote && shouldWrite && field.value !== expected.expect) {
    return {
      verdict: 'FAIL',
      detail: `Wrote "${field.value}" but the source says "${expected.expect}".`,
    };
  }

  if (field.status === expected.status) {
    return { verdict: 'PASS', detail: expected.because };
  }

  // Cautious in the safe direction: nothing wrong was written, but the student
  // has more to do than they should.
  if (!wrote && shouldWrite) {
    return {
      verdict: 'REVIEW',
      detail: `Expected ${expected.status} "${expected.expect}", got ${field.status}: ${field.reason}`,
    };
  }

  return {
    verdict: 'REVIEW',
    detail: `Expected ${expected.status}, got ${field.status}: ${field.reason}`,
  };
}

async function main() {
  const sourceBytes = await buildSourceForm();
  const targets = await buildTargets();

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, '00-source-completed.pdf'), sourceBytes);
  for (const target of targets) {
    writeFileSync(join(OUT_DIR, `blank-${target.documentName}`), target.bytes);
  }

  const result = await runPipeline(
    { documentName: 'ikusasa-completed.pdf', bytes: sourceBytes },
    targets.map((t) => ({ id: t.id, documentName: t.documentName, bytes: t.bytes })),
  );

  if (!result.ok) {
    console.error(`Source form could not be read: ${result.reason}`);
    process.exit(1);
  }

  console.log(`Matcher: ${result.matcher}`);
  console.log(
    `Source: ${result.sourceAnalysis.pageCount} pages, ${result.sourceAnalysis.fields.length} fields, ` +
      `${Object.keys(result.profile.values).length} canonical values read, ` +
      `${result.profile.unmapped.length} left unmapped.\n`,
  );

  // Anything the source held that never became a canonical value.
  if (result.profile.unmapped.length > 0) {
    console.log('Read but not mapped (expected for third-party details):');
    for (const item of result.profile.unmapped) {
      console.log(`  - ${item.label} = "${truncate(item.value, 40)}"`);
    }
    console.log('');
  }

  const rows: Row[] = [];
  const leaks: string[] = [];

  for (const target of targets) {
    const outcome = result.results.find((r) => r.id === target.id);
    if (!outcome) {
      rows.push({
        form: target.documentName,
        label: '(whole form)',
        verdict: 'FAIL',
        detail: 'No result produced.',
      });
      continue;
    }
    if (!outcome.ok) {
      rows.push({
        form: target.documentName,
        label: '(whole form)',
        verdict: 'FAIL',
        detail: outcome.reason,
      });
      continue;
    }

    writeFileSync(join(OUT_DIR, `filled-${target.documentName}`), outcome.bytes);

    const seen = new Set<string>();
    for (const field of outcome.fields) {
      seen.add(field.targetLabel);
      const { verdict, detail } = judge(field, target.expectations[field.targetLabel]);
      rows.push({ form: target.documentName, label: field.targetLabel, verdict, detail });

      if (field.value !== null && FORBIDDEN.some((v) => field.value!.includes(v))) {
        leaks.push(`${target.documentName} / ${field.targetLabel} = "${field.value}"`);
      }
    }

    for (const label of Object.keys(target.expectations)) {
      if (!seen.has(label)) {
        rows.push({
          form: target.documentName,
          label,
          verdict: 'FAIL',
          detail: 'This field was never detected on the target form.',
        });
      }
    }

    const s = outcome.summary;
    console.log(
      `${target.documentName}: ${s.filled}/${s.total} filled, ${s.needsReview} to confirm, ` +
        `${s.missing} missing, ${s.ambiguous} unclear, ${s.signature} signature, ${s.manual} manual ` +
        `(${s.populatedPercent}% populated, ready to submit: ${s.readyToSubmit ? 'yes' : 'no'})`,
    );
    for (const issue of outcome.issues) {
      console.log(`    ${issue.severity}: ${issue.targetFieldName} — ${issue.message}`);
    }
  }

  console.log('');
  const width = Math.max(...rows.map((r) => r.label.length), 10);
  let currentForm = '';
  for (const row of rows) {
    if (row.form !== currentForm) {
      currentForm = row.form;
      console.log(`\n  ${currentForm}`);
    }
    const mark = row.verdict === 'PASS' ? 'PASS  ' : row.verdict === 'REVIEW' ? 'REVIEW' : 'FAIL  ';
    console.log(`    ${mark} ${row.label.padEnd(width)}  ${row.detail}`);
  }

  const pass = rows.filter((r) => r.verdict === 'PASS').length;
  const review = rows.filter((r) => r.verdict === 'REVIEW').length;
  const fail = rows.filter((r) => r.verdict === 'FAIL').length;

  // Read the written PDFs back. Producing bytes is not the same as producing a
  // PDF that carries the values, and the download is what the student submits.
  const readBack: string[] = [];
  for (const target of targets) {
    const outcome = result.results.find((r) => r.id === target.id);
    if (!outcome?.ok) continue;
    const reopened = await analyseDocument(outcome.bytes);
    const onPage = new Map(reopened.fields.map((f) => [f.name, f.value]));
    for (const field of outcome.fields) {
      if (field.value === null || field.targetFieldName.startsWith('text:')) continue;
      const actual = onPage.get(field.targetFieldName);
      if (actual === undefined) {
        readBack.push(
          `${target.documentName} / ${field.targetLabel}: field missing after writing.`,
        );
      } else if ((actual ?? '') !== field.value) {
        readBack.push(
          `${target.documentName} / ${field.targetLabel}: wrote "${truncate(field.value, 30)}" but the saved PDF holds "${truncate(actual ?? '', 30)}".`,
        );
      }
    }
  }

  console.log('\n' + '-'.repeat(72));
  console.log(
    `${rows.length} fields checked: ${pass} pass, ${review} review required, ${fail} fail.`,
  );
  console.log(
    `Overall: ${result.overall.fieldsFilled}/${result.overall.fieldsTotal} fields populated across ${result.overall.targetsProcessed}/${result.overall.targetsTotal} forms (${result.overall.populatedPercent}%).`,
  );
  console.log(`Filled PDFs written to ${OUT_DIR} for visual inspection.`);

  if (readBack.length > 0) {
    console.error('\nThe saved PDF does not match what the engine reported:');
    for (const problem of readBack) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`Read-back check: every populated field is present in the saved PDF.`);

  if (leaks.length > 0) {
    console.error('\nThird-party information leaked onto a target form:');
    for (const leak of leaks) console.error(`  ${leak}`);
    process.exit(1);
  }

  if (fail > 0) {
    console.error(
      `\n${fail} field(s) failed. A wrong or unwarranted value is a defect, not a warning.`,
    );
    process.exit(1);
  }

  console.log('\nNo field was populated with anything the source did not say.');
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
