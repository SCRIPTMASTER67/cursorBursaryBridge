import 'server-only';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { del, head, put } from '@vercel/blob';
import type { PutObjectInput, StorageProvider, StoredObject } from './types';

/**
 * Vercel Blob storage.
 *
 * The local driver writes to the machine's own disk, which a serverless
 * deployment does not have: the filesystem is read-only apart from /tmp, and
 * /tmp belongs to one invocation. A document uploaded by one request would not
 * be there for the request that reads it back. This keeps the same interface
 * and puts the bytes somewhere both requests can reach.
 *
 * Objects are stored with `access: 'public'`, which is Vercel Blob's only
 * mode, so the returned blob URL is unguessable but not access-controlled.
 * That URL is therefore never handed to a browser. `urlFor` keeps pointing at
 * the application's own route, which checks who is asking and then streams the
 * bytes through `get`, exactly as the local driver does. The blob URL stays
 * server-side.
 */
export class BlobStorageProvider implements StorageProvider {
  /**
   * Blob keys are the same shape as the local driver's, so a key stored by one
   * driver still reads as a key under the other and nothing in the database
   * needs migrating to switch.
   */
  async put(input: PutObjectInput): Promise<StoredObject> {
    const extension = path
      .extname(input.fileName)
      .slice(0, 10)
      .replace(/[^A-Za-z0-9.]/g, '');
    const key = path.posix.join(input.prefix, `${randomUUID()}${extension}`);

    await put(key, input.body, {
      access: 'public',
      contentType: input.contentType,
      // The key already carries a UUID, so the store must not add a second
      // random suffix -- the key we return has to be the key we can read back.
      addRandomSuffix: false,
    });

    return { key, sizeBytes: input.body.byteLength };
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      // `head` resolves the key to its URL and content type without downloading.
      const meta = await head(key);
      const response = await fetch(meta.url);
      if (!response.ok) return null;
      return {
        body: Buffer.from(await response.arrayBuffer()),
        contentType: meta.contentType || 'application/octet-stream',
      };
    } catch {
      // A missing object is not an error here; the caller renders "not found".
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await del(key);
    } catch {
      // Deleting an object that is already gone is a no-op.
    }
  }

  urlFor(key: string): string {
    return `/api/documents/file/${encodeURIComponent(key)}`;
  }
}
