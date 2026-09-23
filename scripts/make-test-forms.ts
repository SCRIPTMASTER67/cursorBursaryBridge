/**
 * Build a set of bursary-form PDFs for testing Auto-Fill by hand.
 *
 * One completed form and five blank ones, taken from the same fixtures the
 * automated accuracy harness uses — so what a person sees when they click
 * through is exactly what the tests measure.
 *
 * The funders are invented. Every page is stamped as a sample so none of these
 * can be mistaken for a document issued by a real organisation.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { buildSourceForm, buildTargets } from './fixtures/bursary-forms';

const OUT = 'tmp/test-forms';
const STAMP =
  'SAMPLE FORM — created for software testing. Not issued by, or affiliated with, any real organisation.';

/** Add the stamp to every page without touching anything already on it. */
async function stamp(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    const size = 7;
    const textWidth = font.widthOfTextAtSize(STAMP, size);
    page.drawText(STAMP, {
      x: Math.max(12, (width - textWidth) / 2),
      y: 16,
      size,
      font,
      color: rgb(0.62, 0.62, 0.68),
    });
  }
  // Field values and structure are preserved; only a footer was added.
  return doc.save();
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  writeFileSync(`${OUT}/00-COMPLETED-upload-this-one.pdf`, await stamp(await buildSourceForm()));
  console.log('00-COMPLETED-upload-this-one.pdf   the form to read from');

  const targets = await buildTargets();
  const blanks = targets.slice(0, 5);
  let n = 1;
  for (const target of blanks) {
    const name = `0${n}-BLANK-${target.documentName}`;
    writeFileSync(`${OUT}/${name}`, await stamp(target.bytes));
    console.log(`${name.padEnd(35)} ${Object.keys(target.expectations).length} fields`);
    n += 1;
  }

  console.log(`\nWritten to ${OUT}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
