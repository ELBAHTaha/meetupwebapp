import { BadRequestException, Inject, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { STORAGE_DRIVER, StorageDriver } from './storage.driver';

export interface UploadedLike {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

export type DetectedType = 'jpeg' | 'png' | 'webp' | 'pdf';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
/** Longest edge after re-encoding. */
const MAX_EDGE_PX = 1600;
const WEBP_QUALITY = 80;
/** Refuse decompression bombs (pixels, not bytes). */
const MAX_INPUT_PIXELS = 40_000_000;

/** Identify a file by its signature (magic bytes) — never trust the client's MIME type. */
export function detectFileType(buf: Buffer): DetectedType | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
  return null;
}

const invalid = (message: string) => new BadRequestException({ message, code: 'INVALID_UPLOAD' });

/**
 * Upload handling. Images are validated by signature (jpg/png/webp, ≤5 MB),
 * auto-rotated, resized to ≤1600px, re-encoded to WebP q80 and stripped of all
 * metadata (EXIF/GPS) before they're stored. Business documents may also be
 * PDFs (≤8 MB, stored as-is). Persistence goes through a StorageDriver, so the
 * local disk can be swapped for S3-compatible storage without touching callers.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  /** Validate + re-encode an image and return its public URL. */
  async saveImage(file: UploadedLike, prefix = 'photo', maxBytes = MAX_IMAGE_BYTES): Promise<string> {
    const buf = this.bufferOf(file, maxBytes);
    const type = detectFileType(buf);
    if (type !== 'jpeg' && type !== 'png' && type !== 'webp') {
      throw invalid('Please upload a JPG, PNG or WebP image.');
    }
    let out: Buffer;
    try {
      out = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
        .rotate() // apply EXIF orientation before the metadata is dropped
        .resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer(); // sharp drops EXIF/GPS/ICC unless withMetadata() is called
    } catch (err) {
      this.logger.warn(`Rejected unreadable image: ${(err as Error).message}`);
      throw invalid('That image could not be read. Try another photo.');
    }
    return this.driver.put(`${this.safePrefix(prefix)}-${randomUUID()}.webp`, out, 'image/webp');
  }

  /** Business documents: an image (re-encoded as above) or a PDF (stored as-is). */
  async saveDocument(file: UploadedLike, prefix = 'doc'): Promise<string> {
    const buf = this.bufferOf(file, MAX_DOCUMENT_BYTES);
    const type = detectFileType(buf);
    if (type === 'pdf') {
      return this.driver.put(`${this.safePrefix(prefix)}-${randomUUID()}.pdf`, buf, 'application/pdf');
    }
    if (!type) throw invalid('Please upload a PDF, JPG, PNG or WebP file.');
    return this.saveImage(file, prefix, MAX_DOCUMENT_BYTES);
  }

  /** Back-compat alias — every legacy caller stored photos. */
  save(file: UploadedLike, prefix = 'photo'): Promise<string> {
    return this.saveImage(file, prefix);
  }

  /** Best-effort delete of a file we stored (ignores foreign URLs, e.g. Google avatars). */
  async delete(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const key = this.driver.keyFromUrl(url);
    if (key) await this.driver.delete(key);
  }

  private bufferOf(file: UploadedLike, maxBytes: number): Buffer {
    if (!file?.buffer?.length) throw invalid('The file is empty.');
    if (file.buffer.length > maxBytes) {
      throw new PayloadTooLargeException(`Files can be at most ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    }
    return file.buffer;
  }

  private safePrefix(prefix: string): string {
    return prefix.replace(/[^a-z0-9-]/gi, '').slice(0, 20) || 'file';
  }
}
