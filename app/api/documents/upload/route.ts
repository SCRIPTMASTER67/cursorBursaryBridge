import type { NextRequest } from 'next/server';
import type { DocumentType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { apiError, apiOk, apiStudent } from '@/lib/auth/api';
import { rateLimit } from '@/lib/auth/rate-limit';
import { MAX_UPLOAD_BYTES, isAllowedMimeType, storage } from '@/lib/storage';
import { refreshProfileStrength } from '@/services/student-profile';
import { audit } from '@/services/audit';

const DOCUMENT_TYPES: DocumentType[] = [
  'ID_DOCUMENT',
  'ACADEMIC_RECORD',
  'TRANSCRIPT',
  'MATRIC_CERTIFICATE',
  'PROOF_OF_RESIDENCE',
  'PROOF_OF_INCOME',
  'PROOF_OF_REGISTRATION',
  'CV',
  'MOTIVATION_LETTER',
  'OTHER',
];

/**
 * Upload a supporting document.
 *
 * Type and size are validated on the server before anything is written, and
 * the file is stored under a key namespaced by the student's profile id.
 */
export async function POST(request: NextRequest) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`upload:${auth.user.id}`, 20, 600);
  if (!limit.allowed) {
    return apiError('Too many uploads. Please wait a few minutes and try again.', 429);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return apiError('Invalid upload.');

  const file = formData.get('file');
  const type = String(formData.get('type') ?? '');

  if (!(file instanceof File)) return apiError('Please choose a file to upload.', 422);
  if (!DOCUMENT_TYPES.includes(type as DocumentType)) {
    return apiError('Please choose a document type.', 422, { type: 'Select a document type' });
  }
  if (file.size === 0) return apiError('That file appears to be empty.', 422);
  if (file.size > MAX_UPLOAD_BYTES) {
    return apiError('Files must be 5 MB or smaller.', 422, { file: 'This file is larger than 5 MB' });
  }
  if (!isAllowedMimeType(file.type)) {
    return apiError('Only PDF, JPG, PNG and WebP files are accepted.', 422, {
      file: 'Unsupported file type',
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storage().put({
    prefix: `documents/${auth.studentProfileId}`,
    fileName: file.name,
    contentType: file.type,
    body: buffer,
  });

  const document = await prisma.document.create({
    data: {
      studentProfileId: auth.studentProfileId,
      type: type as DocumentType,
      fileName: file.name.slice(0, 200),
      mimeType: file.type,
      sizeBytes: stored.sizeBytes,
      storageKey: stored.key,
    },
    select: { id: true, type: true, fileName: true, sizeBytes: true, uploadedAt: true },
  });

  await refreshProfileStrength(auth.studentProfileId);
  await audit({
    userId: auth.user.id,
    action: 'document.uploaded',
    entityType: 'Document',
    entityId: document.id,
    metadata: { type },
  });

  return apiOk({ ok: true, document }, 201);
}
