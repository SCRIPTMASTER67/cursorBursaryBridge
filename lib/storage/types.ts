export type PutObjectInput = {
  /** Logical folder, e.g. `documents/<studentProfileId>`. */
  prefix: string;
  fileName: string;
  contentType: string;
  body: Buffer;
};

export type StoredObject = {
  /** Opaque key persisted on the Document row. */
  key: string;
  sizeBytes: number;
};

/**
 * The contract every storage backend implements. Deliberately minimal so an
 * S3, R2 or Azure Blob implementation is a drop-in replacement.
 */
export interface StorageProvider {
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** Where the browser should fetch this object from. */
  urlFor(key: string): string;
}
