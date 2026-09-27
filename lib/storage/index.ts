import 'server-only';
import { env } from '@/lib/env';
import { BlobStorageProvider } from './blob';
import { LocalStorageProvider } from './local';
import { S3StorageProvider } from './s3';
import type { StorageProvider } from './types';

export type { StorageProvider, StoredObject, PutObjectInput } from './types';

/**
 * Storage is resolved once from configuration. Moving off the local disk is a
 * change to STORAGE_DRIVER only — no call site touches the filesystem.
 *
 * `local` writes to the machine's own disk and is right for a single
 * long-lived server. `blob` is Vercel Blob, and is what a serverless
 * deployment needs, since there the filesystem is read-only apart from a /tmp
 * that belongs to one invocation. `s3` remains a seam whose methods throw.
 */
let provider: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (provider) return provider;
  provider =
    env.STORAGE_DRIVER === 'blob'
      ? new BlobStorageProvider()
      : env.STORAGE_DRIVER === 's3'
        ? new S3StorageProvider()
        : new LocalStorageProvider();
  return provider;
}

/** Documents we accept; anything else is rejected before it is written. */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export function isAllowedMimeType(mime: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}
