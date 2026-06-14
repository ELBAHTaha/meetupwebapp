import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTtlMs(): number {
    // Supports "30d" / "900s" style TTLs for the DB expiry.
    const raw = this.config.get<string>('jwt.refreshTtl', '30d');
    const m = /^(\d+)([smhd])$/.exec(raw);
    if (!m) return 30 * 86_400_000;
    const n = Number(m[1]);
    const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]]!;
    return n * unit;
  }

  /** Issue a new access+refresh pair and persist the hashed refresh token. */
  async issue(user: Pick<User, 'id' | 'email' | 'role'>): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessTtl', '900s'),
    });

    // Opaque refresh token (not a JWT) — stored hashed for revocation.
    const refreshToken = `${user.id}.${randomBytes(48).toString('hex')}`;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      },
    });
    return { accessToken, refreshToken };
  }

  /** Validate + rotate a refresh token, returning a fresh pair. */
  async rotate(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hash(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.revoked || record.expiresAt < new Date()) {
      throw new Error('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
    return this.issue(record.user);
  }

  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = this.hash(refreshToken);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
  }
}
