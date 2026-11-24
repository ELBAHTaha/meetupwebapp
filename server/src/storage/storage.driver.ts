/**
 * Where uploaded bytes live. StorageService talks only to this interface, so the
 * local-disk driver can be replaced by an S3-compatible one (R2, B2, MinIO…)
 * later by providing a different implementation under STORAGE_DRIVER.
 */
export interface StorageDriver {
  /** Store `data` under `key` (a flat, safe file name) and return its public URL. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Delete a stored object. Missing objects are not an error. */
  delete(key: string): Promise<void>;
  /** The key for a public URL this driver produced, or null if it isn't ours. */
  keyFromUrl(url: string): string | null;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

/** Keys are flat names we generate ourselves — never paths. */
export const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;
