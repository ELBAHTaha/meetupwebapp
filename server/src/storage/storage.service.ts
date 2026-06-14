import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';

/**
 * Abstracts file persistence so the local-disk driver can be swapped for an
 * S3-compatible one later without touching callers.
 */
@Injectable()
export class StorageService {
  private readonly uploadsDir: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.uploadsDir = config.get<string>('uploadsDir', 'uploads');
    this.publicUrl = config.get<string>('publicUrl', 'http://localhost:4000');
  }

  /** Persist an uploaded buffer and return its public URL. */
  async save(file: { buffer: Buffer; originalname: string; mimetype: string }, prefix = 'photo'): Promise<string> {
    const ext = extname(file.originalname) || this.extFromMime(file.mimetype);
    const name = `${prefix}-${randomUUID()}${ext}`;
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.writeFile(join(this.uploadsDir, name), file.buffer);
    return `${this.publicUrl}/uploads/${name}`;
  }

  private extFromMime(mime: string): string {
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    return '.jpg';
  }
}
