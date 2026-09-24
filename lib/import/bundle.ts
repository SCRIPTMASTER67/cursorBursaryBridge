import JSZip from 'jszip';
import type { DocumentType } from '@prisma/client';

/**
 * Turning an upload into applicants.
 *
 * An organisation's 750 applications arrive in one of two shapes: a pile of
 * PDFs, one per applicant, or a ZIP. A ZIP is the interesting case, because
 * the way people actually file applications is one folder per applicant —
 * the form, plus the ID copy, plus the transcript. That structure is
 * information, and throwing it away would mean telling every funder that no
 * applicant supplied any supporting documents.
 *
 * So: entries at the top level of a ZIP are one application each; entries
 * inside a folder belong to that folder's applicant, with the form being the
 * PDF and the rest being its supporting documents.
 */

export type BundleDocument = {
  fileName: string;
  bytes: Uint8Array;
  /** Classified from the name the organisation itself gave the file. */
  type: DocumentType;
};

export type BundleEntry = {
  /** The application form. */
  fileName: string;
  bytes: Uint8Array;
  /** Anything filed alongside it. */
  documents: BundleDocument[];
};

export type BundleResult = {
  entries: BundleEntry[];
  /** Files that were not usable, kept so the reviewer is told about them. */
  rejected: { fileName: string; reason: string }[];
};

/** Guardrails, so one upload cannot exhaust the machine. */
export const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
export const MAX_ENTRIES = 2_000;
export const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

/**
 * What a supporting document is, judged by its file name.
 *
 * This is deliberately not an attempt to read the document and decide what it
 * is. It uses the label the organisation already applied when it saved the
 * file — "Thabo_ID_copy.pdf" — which is evidence rather than inference, and
 * which the reviewer can check at a glance because the file name is shown next
 * to the classification. A name that says nothing is OTHER, not a guess.
 */
export function classifyDocument(fileName: string): DocumentType {
  const name = fileName.toLowerCase().replace(/[_-]+/g, ' ');

  if (/\b(id|identity|identification|smart card|birth certificate)\b/.test(name)) {
    return 'ID_DOCUMENT';
  }
  if (/\b(matric|nsc|grade 12|senior certificate)\b/.test(name)) return 'MATRIC_CERTIFICATE';
  if (/\b(transcript|academic record|results|statement of results|marks)\b/.test(name)) {
    return 'TRANSCRIPT';
  }
  if (/\b(registration|proof of registration|enrolment|enrollment|admission)\b/.test(name)) {
    return 'PROOF_OF_REGISTRATION';
  }
  if (/\b(income|payslip|pay slip|salary|affidavit|sassa|unemploy)\b/.test(name)) {
    return 'PROOF_OF_INCOME';
  }
  if (/\b(residence|address|municipal|utility)\b/.test(name)) return 'PROOF_OF_RESIDENCE';
  if (/\b(cv|curriculum vitae|resume)\b/.test(name)) return 'CV';
  if (/\b(motivation|motivational|cover letter|covering letter)\b/.test(name)) {
    return 'MOTIVATION_LETTER';
  }
  return 'OTHER';
}

/** True when the name looks like an application form rather than an annexure. */
function looksLikeForm(fileName: string): boolean {
  return /\b(application|form|bursary|applicant)\b/i.test(fileName);
}

function isPdf(fileName: string, bytes: Uint8Array): boolean {
  if (!/\.pdf$/i.test(fileName)) return false;
  // Trust the bytes rather than the extension: a renamed file is the most
  // common cause of a batch that "processed" into nonsense.
  return (
    bytes.length > 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

/** macOS and Windows both litter archives; none of it is an application. */
function isNoise(path: string): boolean {
  const base = path.split('/').pop() ?? '';
  return (
    path.startsWith('__MACOSX/') ||
    base.startsWith('._') ||
    base === '.DS_Store' ||
    base === 'Thumbs.db' ||
    base.startsWith('.')
  );
}

/**
 * Choose the application form from the files filed together.
 *
 * The name is tried first, because a file called "Application Form.pdf" is one.
 * Failing that, the largest PDF: a form with answers on it is almost always
 * longer than the ID copy next to it. If there is exactly one PDF the question
 * does not arise.
 */
function chooseForm(files: { fileName: string; bytes: Uint8Array }[]) {
  const pdfs = files.filter((file) => isPdf(file.fileName, file.bytes));
  if (pdfs.length === 0) return null;
  if (pdfs.length === 1) return pdfs[0];

  const named = pdfs.find((file) => looksLikeForm(file.fileName));
  if (named) return named;

  return pdfs.reduce((largest, file) =>
    file.bytes.length > largest.bytes.length ? file : largest,
  );
}

async function expandZip(fileName: string, bytes: Uint8Array, result: BundleResult) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    result.rejected.push({
      fileName,
      reason: 'This ZIP could not be opened. It may be damaged or password protected.',
    });
    return;
  }

  // Group by the folder each file sits in. The root is its own group, where
  // every file stands alone as one application.
  const groups = new Map<string, { fileName: string; bytes: Uint8Array }[]>();

  for (const path of Object.keys(zip.files)) {
    const entry = zip.files[path];
    if (entry.dir || isNoise(path)) continue;

    const contents = await entry.async('uint8array');
    if (contents.length === 0) continue;
    if (contents.length > MAX_ENTRY_BYTES) {
      result.rejected.push({
        fileName: path,
        reason: 'This file is larger than the 20 MB limit for a single application.',
      });
      continue;
    }

    const parts = path.split('/').filter(Boolean);
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    const base = parts[parts.length - 1];

    const key = folder === '' ? `::root::${base}` : folder;
    const bucket = groups.get(key) ?? [];
    bucket.push({ fileName: base, bytes: contents });
    groups.set(key, bucket);
  }

  for (const [key, files] of groups) {
    const form = chooseForm(files);
    if (!form) {
      // A folder with no PDF in it is reported rather than dropped: the
      // organisation put it in the upload and deserves to know why nothing
      // came of it.
      const label = key.startsWith('::root::') ? key.slice('::root::'.length) : key;
      result.rejected.push({
        fileName: label,
        reason: 'No PDF was found here, so there is no application form to read.',
      });
      continue;
    }

    result.entries.push({
      fileName: form.fileName,
      bytes: form.bytes,
      documents: files
        .filter((file) => file !== form)
        .map((file) => ({
          fileName: file.fileName,
          bytes: file.bytes,
          type: classifyDocument(file.fileName),
        })),
    });
  }
}

/**
 * Expand an upload into one entry per applicant.
 *
 * Takes what the browser sent — PDFs, ZIPs, or both — and returns the
 * application forms with their supporting documents attached, plus everything
 * that could not be used and the reason. Nothing is silently dropped.
 */
export async function expandUpload(
  uploads: { fileName: string; bytes: Uint8Array }[],
): Promise<BundleResult> {
  const result: BundleResult = { entries: [], rejected: [] };
  let totalBytes = 0;

  for (const upload of uploads) {
    totalBytes += upload.bytes.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      result.rejected.push({
        fileName: upload.fileName,
        reason: 'The upload exceeded the total size limit and this file was not read.',
      });
      continue;
    }

    if (/\.zip$/i.test(upload.fileName)) {
      await expandZip(upload.fileName, upload.bytes, result);
      continue;
    }

    if (!isPdf(upload.fileName, upload.bytes)) {
      result.rejected.push({
        fileName: upload.fileName,
        reason: /\.pdf$/i.test(upload.fileName)
          ? 'This file is named as a PDF but is not one.'
          : 'Only PDF application forms and ZIP archives can be imported.',
      });
      continue;
    }

    if (upload.bytes.length > MAX_ENTRY_BYTES) {
      result.rejected.push({
        fileName: upload.fileName,
        reason: 'This file is larger than the 20 MB limit for a single application.',
      });
      continue;
    }

    result.entries.push({ fileName: upload.fileName, bytes: upload.bytes, documents: [] });
  }

  if (result.entries.length > MAX_ENTRIES) {
    for (const extra of result.entries.slice(MAX_ENTRIES)) {
      result.rejected.push({
        fileName: extra.fileName,
        reason: `More than ${MAX_ENTRIES} applications in one batch. Split the upload and import the rest separately.`,
      });
    }
    result.entries = result.entries.slice(0, MAX_ENTRIES);
  }

  return result;
}
