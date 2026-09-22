import { MAX_UPLOAD_BYTES } from '@/lib/storage';

/**
 * Checking an uploaded form before anything is done with it.
 *
 * The declared content type is not trusted: a file is accepted only if it
 * begins with a PDF header. Everything else is refused with a reason the
 * student can act on.
 */

export type UploadCheck =
  | { ok: true; fileName: string; bytes: Buffer }
  | { ok: false; message: string };

const PDF_MAGIC = '%PDF-';

export async function readPdfUpload(file: unknown, label: string): Promise<UploadCheck> {
  if (!(file instanceof File)) {
    return { ok: false, message: `Please choose a ${label}.` };
  }
  if (file.size === 0) {
    return { ok: false, message: `"${file.name}" appears to be empty.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: `"${file.name}" is larger than 5 MB.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC) {
    return {
      ok: false,
      message: `"${file.name}" is not a PDF. Bursary forms must be uploaded as PDF files.`,
    };
  }

  return { ok: true, fileName: file.name, bytes };
}
