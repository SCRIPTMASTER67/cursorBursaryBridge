import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import type { PutObjectInput, StorageProvider, StoredObject } from './types';

/**
 * Development storage.
 *
 * Files are written OUTSIDE `public/` and served only through an authorised
 * route handler, so uploaded documents are never publicly addressable.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly root = path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR);

  /** Reject any key that tries to escape the storage root. */
  private resolveSafe(key: string): string {
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const extension = path.extname(input.fileName).slice(0, 10).replace(/[^A-Za-z0-9.]/g, '');
    const key = path.posix.join(input.prefix, `${randomUUID()}${extension}`);
    const target = this.resolveSafe(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.body);
    await writeFile(`${target}.meta`, JSON.stringify({ contentType: input.contentType }));
    return { key, sizeBytes: input.body.byteLength };
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const target = this.resolveSafe(key);
      const body = await readFile(target);
      let contentType = 'application/octet-stream';
      try {
        const meta = JSON.parse(await readFile(`${target}.meta`, 'utf8')) as { contentType?: string };
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        // Missing sidecar is not fatal — fall back to the generic type.
      }
      return { body, contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const target = this.resolveSafe(key);
      await unlink(target);
      await unlink(`${target}.meta`).catch(() => undefined);
    } catch {
      // Deleting an object that is already gone is a no-op.
    }
  }

  urlFor(key: string): string {
    return `/api/documents/file/${encodeURIComponent(key)}`;
  }
}
