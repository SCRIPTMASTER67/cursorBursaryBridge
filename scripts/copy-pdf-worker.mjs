/**
 * Put the pdf.js worker where the browser can fetch it.
 *
 * The review screen renders a page of a filled PDF, which needs pdf.js's
 * worker and its standard font files. Referencing them as package paths leaves
 * the bundler to resolve ESM and binary assets it cannot, so they are copied to
 * `public/` at build time and loaded by URL instead. They are vendored output,
 * not source, so they are copied rather than committed.
 */
import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const source = path.join(
  path.dirname(require.resolve('pdfjs-dist/package.json')),
  'legacy/build/pdf.worker.min.mjs',
);
const target = path.resolve(process.cwd(), 'public/pdf.worker.min.mjs');

mkdirSync(path.dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Copied pdf.js worker to ${path.relative(process.cwd(), target)}`);

// Without these, pdf.js asks for a standard font over the network on every
// render and gets a 404 back.
const fontsSource = path.join(
  path.dirname(require.resolve('pdfjs-dist/package.json')),
  'standard_fonts',
);
const fontsTarget = path.resolve(process.cwd(), 'public/pdf-standard-fonts');
cpSync(fontsSource, fontsTarget, { recursive: true });
console.log(`Copied pdf.js standard fonts to ${path.relative(process.cwd(), fontsTarget)}`);
