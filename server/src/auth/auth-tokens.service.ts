import { Injectable } from '@nestjs/common';
import { AuthTokenType } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
export const EMAIL_VERIFY_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export function hashAuthToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * One-time tokens for emailed links (password reset, email verification).
 * The raw token only ever leaves the server inside the email; the DB stores its
 * SHA-256 hash. Tokens are single-use, expire, and issuing a new one of the same
 * type invalidates any older unused ones for that user.
 */
@Injectable()
export class AuthTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issue a fresh token (invalidating older unused ones). Returns the RAW token. */
  async issue(userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({
        where: { userId, type, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.authToken.create({
        data: { userId, type, tokenHash: hashAuthToken(raw), expiresAt: new Date(now.getTime() + ttlMs) },
      }),
    ]);
    return raw;
  }

  /**
   * Atomically consume a token. Returns the owning userId, or null when the token
   * is unknown, of the wrong type, expired or already used.
   */
  async consume(raw: string, type: AuthTokenType): Promise<string | null> {
    if (!raw || raw.length > 200) return null;
    const tokenHash = hashAuthToken(raw);
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash } });
    if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) return null;
    // Guard against a concurrent double-use: only one updateMany can flip usedAt.
    const { count } = await this.prisma.authToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1 ? record.userId : null;
  }

  /** How many tokens of this type were issued to the user within the window. */
  countRecent(userId: string, type: AuthTokenType, windowMs: number): Promise<number> {
    return this.prisma.authToken.count({
      where: { userId, type, createdAt: { gte: new Date(Date.now() - windowMs) } },
    });
  }

  /** Invalidate every outstanding token of a type (e.g. after a successful reset). */
  async revokeAll(userId: string, type: AuthTokenType): Promise<void> {
    await this.prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  }
}
