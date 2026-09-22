import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import type { MappedField } from './map';

/**
 * Writing into the target PDF.
 *
 * The original document is loaded and written back, never rebuilt, so page
 * size, layout, branding, logos, tables, headers and footers survive exactly
 * as the funder designed them. Only field values are added.
 *
 * Native form fields are used whenever the PDF has them. A flat PDF is
 * overlaid instead: the text is drawn on top of the untouched page, sized and
 * wrapped to stay inside its box.
 */

export type FillOutcome = {
  targetFieldName: string;
  written: boolean;
  /**
   * Set when the value could not be placed legibly. With `written: false`
   * nothing reached the page; with `written: true` the value is in the field
   * but will not display well, so the student is asked to look at it.
   */
  problem?: string;
};

export type FillResult = {
  bytes: Uint8Array;
  outcomes: FillOutcome[];
};

const MIN_FONT_SIZE = 6;
const DEFAULT_FONT_SIZE = 10;

export async function fillTarget(
  originalBytes: Uint8Array,
  fields: MappedField[],
): Promise<FillResult> {
  const doc = await PDFDocument.load(originalBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const outcomes: FillOutcome[] = [];

  let form: ReturnType<PDFDocument['getForm']> | null = null;
  try {
    form = doc.getForm();
  } catch {
    form = null;
  }

  for (const field of fields) {
    // Nothing without a value is written. This is the never-guess rule made
    // physical: a field the engine was unsure about stays visibly blank.
    if (field.value === null) {
      outcomes.push({ targetFieldName: field.targetFieldName, written: false });
      continue;
    }

    if (field.rect === null && field.kind !== 'checkbox') {
      outcomes.push({
        targetFieldName: field.targetFieldName,
        written: false,
        problem: 'No position could be determined for this field.',
      });
      continue;
    }

    // --- native form field ---------------------------------------------
    let handled = false;
    let cramped: string | null = null;
    if (form && !field.targetFieldName.startsWith('text:')) {
      try {
        const target = form.getFieldMaybe(field.targetFieldName);
        if (target) {
          if (target instanceof PDFTextField) {
            target.setText(field.value);
            target.setFontSize(0); // auto-size to the widget
            handled = true;
            // The value is correct and the student can still edit it in any
            // reader, so it stays. But a box this text cannot be read in is
            // not a finished field, so it is flagged rather than called done.
            if (
              field.rect &&
              !fits(field.value, field.rect, target.isMultiline(), (t, size) =>
                font.widthOfTextAtSize(t, size),
              )
            ) {
              cramped =
                'This answer is longer than the space the form allows. Check it reads properly, or shorten it.';
            }
          } else if (target instanceof PDFCheckBox) {
            if (field.value === 'true') target.check();
            else target.uncheck();
            handled = true;
          } else if (target instanceof PDFRadioGroup) {
            target.select(field.value);
            handled = true;
          } else if (target instanceof PDFDropdown) {
            target.select(field.value);
            handled = true;
          }
        }
      } catch (error) {
        outcomes.push({
          targetFieldName: field.targetFieldName,
          written: false,
          problem: error instanceof Error ? error.message : 'Field could not be set.',
        });
        continue;
      }
    }

    if (handled) {
      outcomes.push({
        targetFieldName: field.targetFieldName,
        written: true,
        ...(cramped ? { problem: cramped } : {}),
      });
      continue;
    }

    // --- overlay onto a flat page ---------------------------------------
    const page = doc.getPages()[field.page - 1];
    if (!page || !field.rect) {
      outcomes.push({
        targetFieldName: field.targetFieldName,
        written: false,
        problem: 'The page for this field could not be found.',
      });
      continue;
    }

    const layout = layoutText(field.value, field.rect.width, field.rect.height, (text, size) =>
      font.widthOfTextAtSize(text, size),
    );

    if (!layout) {
      // Rather than truncate information or let it run across a neighbouring
      // field, the value is left off and the student is told.
      outcomes.push({
        targetFieldName: field.targetFieldName,
        written: false,
        problem:
          'The text is too long for the space on this form. Please complete this field by hand.',
      });
      continue;
    }

    const lineHeight = layout.size * 1.15;
    let y = field.rect.y + field.rect.height - layout.size - 1;
    for (const line of layout.lines) {
      page.drawText(line, {
        x: field.rect.x + 2,
        y,
        size: layout.size,
        font,
        color: rgb(0.06, 0.07, 0.17),
      });
      y -= lineHeight;
    }
    outcomes.push({ targetFieldName: field.targetFieldName, written: true });
  }

  // Keep fields interactive so the student can still edit the PDF afterwards.
  const bytes = await doc.save();
  return { bytes, outcomes };
}

/** Whether a value can be shown legibly in a form field's own box. */
function fits(
  value: string,
  rect: { width: number; height: number },
  multiline: boolean,
  measure: (text: string, size: number) => number,
): boolean {
  if (!multiline) {
    // A single-line field shrinks the text rather than wrapping it.
    return measure(value, MIN_FONT_SIZE) <= rect.width - 4;
  }
  return layoutText(value, rect.width, rect.height, measure) !== null;
}

/**
 * Fit text into a box.
 *
 * Tries the default size, then shrinks to a floor, wrapping at each step.
 * Returns null when the text cannot be shown legibly in the space, which the
 * caller turns into a flag rather than a silent truncation.
 */
export function layoutText(
  text: string,
  width: number,
  height: number,
  measure: (text: string, size: number) => number,
): { lines: string[]; size: number } | null {
  const usableWidth = Math.max(0, width - 4);
  const usableHeight = Math.max(0, height - 2);
  if (usableWidth <= 0 || usableHeight <= 0) return null;

  for (let size = DEFAULT_FONT_SIZE; size >= MIN_FONT_SIZE; size -= 0.5) {
    const lines = wrap(text, usableWidth, size, measure);
    if (!lines) continue;
    if (lines.length * size * 1.15 <= usableHeight + size * 0.15) {
      return { lines, size };
    }
  }
  return null;
}

function wrap(
  text: string,
  width: number,
  size: number,
  measure: (text: string, size: number) => number,
): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    // A single word wider than the box cannot be wrapped at this size.
    if (measure(word, size) > width) return null;
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, size) <= width) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : null;
}
