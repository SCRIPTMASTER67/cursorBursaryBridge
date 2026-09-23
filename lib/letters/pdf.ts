import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * A letter as a PDF.
 *
 * Typeset rather than screenshotted: real text in a real font, so a funder can
 * select and search it, and so it prints the way a letter should. The layout
 * is deliberately plain — a motivational letter with a designed header looks
 * like a template, which is the opposite of what it is trying to say.
 */

const PAGE = { width: 595.28, height: 841.89 }; // A4, points
const MARGIN = 64;
const SIZE = 11;
const LEADING = 16.5;

/** Break a paragraph into lines that fit the measure. */
function wrap(
  text: string,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, SIZE) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // A single word wider than the measure is broken rather than overflowing.
    if (font.widthOfTextAtSize(word, SIZE) > maxWidth) {
      let chunk = '';
      for (const character of word) {
        if (font.widthOfTextAtSize(chunk + character, SIZE) > maxWidth) {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk += character;
        }
      }
      line = chunk;
    } else {
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * WinAnsi cannot encode every character a student might paste in (curly
 * quotes are fine; an em dash from a word processor is fine; an emoji is not).
 * Substituting is better than throwing away the student's whole letter.
 */
function encodable(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ–—…]/g, '');
}

export async function letterToPdf(content: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const measure = PAGE.width - MARGIN * 2;

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const draw = (line: string) => {
    if (y < MARGIN) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
    page.drawText(line, { x: MARGIN, y, size: SIZE, font, color: rgb(0.1, 0.1, 0.12) });
    y -= LEADING;
  };

  for (const rawLine of encodable(content).split('\n')) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      y -= LEADING * 0.6;
      continue;
    }
    for (const wrapped of wrap(line, font, measure)) draw(wrapped);
  }

  return pdf.save();
}

/** A filename a student can find again in their downloads folder. */
export function letterFileName(title: string): string {
  const base =
    title
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'letter';
  return `${base}.pdf`;
}
