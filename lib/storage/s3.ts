import 'server-only';
import type { PutObjectInput, StorageProvider, StoredObject } from './types';

/**
 * Production storage seam.
 *
 * The prototype ships the interface but not the SDK, so no AWS dependency is
 * pulled into the build. To enable: install `@aws-sdk/client-s3`, implement the
 * four methods below against the S3_* environment variables, and set
 * STORAGE_DRIVER="s3". No calling code changes.
 */
export class S3StorageProvider implements StorageProvider {
  private unavailable(): never {
    throw new Error(
      'S3 storage is not configured in this prototype. Set STORAGE_DRIVER="local", ' +
        'or implement S3StorageProvider with @aws-sdk/client-s3.',
    );
  }

  async put(_input: PutObjectInput): Promise<StoredObject> {
    this.unavailable();
  }

  async get(_key: string): Promise<{ body: Buffer; contentType: string } | null> {
    this.unavailable();
  }

  async delete(_key: string): Promise<void> {
    this.unavailable();
  }

  urlFor(key: string): string {
    return `/api/documents/file/${encodeURIComponent(key)}`;
  }
}
