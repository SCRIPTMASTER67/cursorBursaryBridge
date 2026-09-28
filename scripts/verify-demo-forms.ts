/**
 * Check the demonstration forms still fill correctly.
 *
 * `npm run test:pdf` measures the accuracy of the auto-fill engine against the
 * fixtures held in memory. This checks something different and narrower: that
 * the actual PDF files in tmp/test-forms -- the ones handed to somebody to
 * click through, each with a SAMPLE stamp drawn onto every page after the
 * fixture was built -- still read and fill the way the fixtures do.
 *
 * The stamp is the reason this exists. It is added by make-test-forms after
 * the form fields are in place, and a demonstration that fails in front of an
 * examiner because a late drawing step disturbed the document is a bad way to
 * find that out.
 *
 * Usage: npm run make:test-forms, then `npm run verify:demo-forms`.
 */
import { readFileSync } from 'node:fs';
import { runPipeline } from '@/lib/pdf/pipeline';

const DIR = 'tmp/test-forms';
const SOURCE = '00-COMPLETED-upload-this-one.pdf';
const BLANKS = [
  '01-BLANK-sizani-education-fund.pdf',
  '02-BLANK-thuto-mining-bursary.pdf',
  '03-BLANK-lerato-legacy-scholarship.pdf',
  '04-BLANK-nkosi-engineering-trust.pdf',
  '05-BLANK-amanzi-water-board.pdf',
];

/**
 * The pair used in the demonstration. Every field on this form is expected to
 * be populated, so anything less means the demonstration no longer shows what
 * it is supposed to show, and this run fails rather than printing a number
 * nobody reads.
 */
const DEMO_TARGET = '01-BLANK-sizani-education-fund.pdf';

async function main() {
  let source: Buffer;
  try {
    source = readFileSync(`${DIR}/${SOURCE}`);
  } catch {
    console.error(`\n${DIR}/${SOURCE} is not there. Run: npm run make:test-forms\n`);
    process.exit(1);
  }

  const result = await runPipeline(
    { documentName: SOURCE, bytes: source },
    BLANKS.map((documentName, i) => ({
      id: String(i),
      documentName,
      bytes: readFileSync(`${DIR}/${documentName}`),
    })),
  );

  if (!result.ok) {
    console.error(`\nThe completed form could not be read: ${result.reason}\n`);
    process.exit(1);
  }

  console.log(`\nRead from ${SOURCE}, filling ${BLANKS.length} forms:\n`);

  let failed = false;
  for (const target of result.results) {
    if (!target.ok) {
      console.log(`  FAIL  ${target.documentName} — ${target.reason}`);
      failed = true;
      continue;
    }

    const count = (status: string) => target.fields.filter((f) => f.status === status).length;
    const filled = count('FILLED');
    const total = target.fields.length;

    console.log(
      `  ${target.documentName.padEnd(40)} ${filled}/${total} filled, ` +
        `${count('NEEDS_REVIEW')} to confirm, ${count('MISSING')} missing, ` +
        `${count('SIGNATURE')} signature, ${count('MANUAL')} manual`,
    );

    if (target.documentName === DEMO_TARGET && filled !== total) {
      console.log(
        `\n  The demonstration form filled ${filled} of ${total} fields, not all of them.\n`,
      );
      failed = true;
    }
  }

  console.log('');
  process.exit(failed ? 1 : 0);
}

void main();
