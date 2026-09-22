import { PDFCheckBox, PDFDocument, PDFDropdown, PDFRadioGroup, PDFTextField } from 'pdf-lib';

/**
 * Reading PDFs.
 *
 * Two shapes are handled, and the difference matters throughout the pipeline:
 *
 *  - A PDF with AcroForm fields. Field names and widget rectangles are exact,
 *    so both extraction and population are reliable.
 *  - A flat PDF with printed labels and blank space. Labels are recovered from
 *    the text layer by position; the answer area is inferred. Less certain, and
 *    the confidence assigned downstream reflects that.
 *
 * A PDF with neither fields nor a text layer is almost always a scan. This
 * module reports that rather than pretending to have read it.
 */

export type FieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature' | 'unknown';

export type DetectedField = {
  /** The PDF field name, or a synthetic id for a detected text label. */
  name: string;
  /** The human-readable label shown on the page. */
  label: string;
  kind: FieldKind;
  page: number;
  /** PDF user-space rectangle of the answer area. */
  rect: { x: number; y: number; width: number; height: number } | null;
  /** Current value, when the form already carries one. */
  value: string | null;
  /** For radios and dropdowns. */
  options?: string[];
  source: 'acroform' | 'text-layout';
};

export type DocumentAnalysis = {
  pageCount: number;
  hasAcroForm: boolean;
  hasTextLayer: boolean;
  /** No fields and no text: nothing can be read without OCR. */
  likelyScanned: boolean;
  encrypted: boolean;
  fields: DetectedField[];
};

/** Turn a PDF field name into something a person can read. */
export function humaniseFieldName(name: string): string {
  return name
    .replace(/^(txt|chk|rad|fld|cb|tf)[_\-]?/i, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function kindOf(field: unknown): FieldKind {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  return 'unknown';
}

/** Signature fields are never auto-populated; they are detected so they can be flagged. */
function looksLikeSignature(label: string): boolean {
  return /\bsignature|\bsigned\b|\bsign here\b/i.test(label);
}

export async function analyseDocument(bytes: Uint8Array): Promise<DocumentAnalysis> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt/i.test(message)) {
      return {
        pageCount: 0,
        hasAcroForm: false,
        hasTextLayer: false,
        likelyScanned: false,
        encrypted: true,
        fields: [],
      };
    }
    throw error;
  }

  const pageCount = doc.getPageCount();
  const pages = doc.getPages();
  const pageIndexByRef = new Map<unknown, number>();
  pages.forEach((page, index) => pageIndexByRef.set(page.ref, index + 1));

  const fields: DetectedField[] = [];
  let hasAcroForm = false;

  try {
    const form = doc.getForm();
    const formFields = form.getFields();
    hasAcroForm = formFields.length > 0;

    for (const field of formFields) {
      const name = field.getName();
      const label = humaniseFieldName(name);
      const widgets = field.acroField.getWidgets();
      const widget = widgets[0];
      const rect = widget ? widget.getRectangle() : null;
      const pageRef = widget?.P();
      const page = (pageRef && pageIndexByRef.get(pageRef)) ?? 1;

      let value: string | null = null;
      let options: string[] | undefined;
      const kind = looksLikeSignature(label) ? 'signature' : kindOf(field);

      if (field instanceof PDFTextField) value = field.getText() ?? null;
      else if (field instanceof PDFCheckBox) value = field.isChecked() ? 'true' : 'false';
      else if (field instanceof PDFRadioGroup) {
        value = field.getSelected() ?? null;
        options = field.getOptions();
      } else if (field instanceof PDFDropdown) {
        value = field.getSelected()[0] ?? null;
        options = field.getOptions();
      }

      fields.push({ name, label, kind, page, rect, value, options, source: 'acroform' });
    }
  } catch {
    hasAcroForm = false;
  }

  const { hasTextLayer, textFields } = await extractTextLayout(bytes, pageCount);

  // Only fall back to label detection when the document carries no real fields.
  if (!hasAcroForm) fields.push(...textFields);

  return {
    pageCount,
    hasAcroForm,
    hasTextLayer,
    likelyScanned: !hasAcroForm && !hasTextLayer,
    encrypted: false,
    fields,
  };
}

type TextItem = { str: string; x: number; y: number; width: number; height: number; page: number };

/**
 * Recover labels from the text layer.
 *
 * A label is a run of text ending in a colon. The answer area is taken to be
 * the space to its right on the same line, stopping before the next text item.
 * This is a heuristic, which is why fields found this way carry a lower
 * confidence than AcroForm fields when they are populated.
 */
async function extractTextLayout(
  bytes: Uint8Array,
  pageCount: number,
): Promise<{ hasTextLayer: boolean; textFields: DetectedField[] }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await task.promise;

  const items: TextItem[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pageCount, pdf.numPages); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      items.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width ?? 0,
        height: item.height ?? 10,
        page: pageNumber,
      });
    }
  }
  await pdf.destroy();

  const hasTextLayer = items.length > 0;
  const textFields: DetectedField[] = [];

  const byPage = new Map<number, TextItem[]>();
  for (const item of items) {
    if (!byPage.has(item.page)) byPage.set(item.page, []);
    byPage.get(item.page)!.push(item);
  }

  for (const [page, pageItems] of byPage) {
    const sorted = [...pageItems].sort((a, b) => b.y - a.y || a.x - b.x);
    for (let i = 0; i < sorted.length; i += 1) {
      const item = sorted[i];
      const text = item.str.trim();
      if (!text.endsWith(':')) continue;
      const label = text.slice(0, -1).trim();
      if (!label || label.length > 60) continue;

      // The answer area runs from just after the label to the next item on the
      // same line, or to a sensible default width.
      const sameLine = sorted.filter(
        (other) => other !== item && Math.abs(other.y - item.y) < 4 && other.x > item.x,
      );
      const next = sameLine.sort((a, b) => a.x - b.x)[0];
      const startX = item.x + item.width + 4;
      const endX = next ? next.x - 4 : startX + 220;

      textFields.push({
        name: `text:${page}:${Math.round(item.x)}:${Math.round(item.y)}`,
        label,
        kind: looksLikeSignature(label) ? 'signature' : 'text',
        page,
        rect: {
          x: startX,
          y: item.y - 2,
          width: Math.max(40, endX - startX),
          height: item.height + 4,
        },
        value: null,
        source: 'text-layout',
      });
    }
  }

  return { hasTextLayer, textFields };
}
