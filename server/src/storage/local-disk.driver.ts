import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { SAFE_KEY, StorageDriver } from './storage.driver';

/** Files on the VPS disk (the `uploads` Docker volume), served at /uploads/<key>. */
@Injectable()
export class LocalDiskDriver implements StorageDriver {
  private readonly logger = new Logger(LocalDiskDriver.name);
  private readonly dir: string;
  private readonly base: string;

  constructor(config: ConfigService) {
    this.dir = config.get<string>('uploadsDir', 'uploads');
    this.base = `${config.get<string>('publicUrl', 'http://localhost:4000').replace(/\/$/, '')}/uploads/`;
  }

  async put(key: string, data: Buffer): Promise<string> {
    if (!SAFE_KEY.test(key)) throw new Error(`Unsafe storage key: ${key}`);
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(join(this.dir, key), data);
    return this.base + key;
  }

  async delete(key: string): Promise<void> {
    if (!SAFE_KEY.test(key)) return;
    try {
      await fs.unlink(join(this.dir, key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Could not delete ${key}: ${(err as Error).message}`);
      }
    }
  }

  keyFromUrl(url: string): string | null {
    // Only our own URLs (or bare /uploads/<key> paths) — never e.g. a Google avatar.
    let rest: string | null = null;
    if (url.startsWith(this.base)) rest = url.slice(this.base.length);
    else if (url.startsWith('/uploads/')) rest = url.slice('/uploads/'.length);
    if (rest === null) return null;
    const key = rest.split(/[?#]/)[0];
    return SAFE_KEY.test(key) ? key : null;
  }
}
