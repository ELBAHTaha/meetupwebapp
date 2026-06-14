import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Single source of truth for the 0–5 `trustScore`.
 *
 * `trustScore = clamp(ratingsAvg + reliabilityAdj, 0, 5)` where `reliabilityAdj`
 * accumulates behavioural deltas (no-shows, late cancels, reports, on-time, host
 * success — scaled from the product's point spec onto the 0–5 scale).
 */
@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Recompute trustScore from ratings + the stored reliability adjustment. */
  async recompute(userId: string): Promise<void> {
    const [received, flags, user] = await Promise.all([
      this.prisma.rating.findMany({ where: { toUserId: userId }, select: { score: true } }),
      this.prisma.flag.findMany({ where: { userId }, select: { eventId: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { reliabilityAdj: true } }),
    ]);
    if (!user) return;
    const ratingsAvg = received.length ? received.reduce((s, r) => s + r.score, 0) / received.length : 5.0;
    const adj = Number(user.reliabilityAdj);
    const trust = clamp(ratingsAvg + adj, 0, 5);
    const flagCount = new Set(flags.map((f) => f.eventId)).size;
    await this.prisma.user.update({
      where: { id: userId },
      data: { trustScore: new Prisma.Decimal(trust.toFixed(2)), flagCount },
    });
  }

  /**
   * Apply a behavioural delta (scaled to the 0–5 scale) and recompute. Examples:
   * no-show −0.75, late cancel −0.50, reported −2.50, on-time +0.25, host +0.50.
   */
  async adjust(userId: string, delta: number, reason: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { reliabilityAdj: true } });
    if (!user) return;
    const next = clamp(Number(user.reliabilityAdj) + delta, -5, 5);
    await this.prisma.user.update({
      where: { id: userId },
      data: { reliabilityAdj: new Prisma.Decimal(next.toFixed(2)) },
    });
    await this.recompute(userId);
    this.logger.log(`Trust adjust ${delta > 0 ? '+' : ''}${delta} for ${userId} (${reason}).`);
  }
}
