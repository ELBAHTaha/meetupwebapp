import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { publicUser, userPublicInclude } from '../common/serializers/user.serializer';

/**
 * User blocking. Lookups here back every enforcement point: joins, the discover
 * feed, hosted-event pages, profiles (404 both ways) and group-chat messages
 * (the blocker stops seeing the blocked user's messages, live and on reload).
 */
@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async block(blockerId: string, blockedId: string): Promise<{ success: true }> {
    if (blockerId === blockedId) throw new BadRequestException('You can’t block yourself.');
    const target = await this.prisma.user.findUnique({ where: { id: blockedId }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('User not found.');
    if (target.role === 'ADMIN') throw new BadRequestException('Team accounts can’t be blocked. Report a problem instead.');
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
    return { success: true };
  }

  async unblock(blockerId: string, blockedId: string): Promise<{ success: true }> {
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
    return { success: true };
  }

  /** People I've blocked (newest first), as public profiles. */
  async listMine(blockerId: string) {
    const rows = await this.prisma.block.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { include: userPublicInclude } },
    });
    return rows.map((r) => ({ ...publicUser(r.blocked), blockedAt: r.createdAt.toISOString() }));
  }

  /** True if either user blocked the other. */
  async eitherWay(a: string | undefined, b: string | undefined): Promise<boolean> {
    if (!a || !b || a === b) return false;
    const n = await this.prisma.block.count({
      where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    });
    return n > 0;
  }

  /** Everyone I blocked or who blocked me — hidden from each other's feed. */
  async relatedIds(userId: string | undefined): Promise<string[]> {
    if (!userId) return [];
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return [...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
  }

  /** Users I've blocked (their chat messages are hidden from me). */
  async blockedBy(blockerId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({ where: { blockerId }, select: { blockedId: true } });
    return rows.map((r) => r.blockedId);
  }

  /** Users who blocked `userId` (they shouldn't receive that user's messages). */
  async blockersOf(userId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } });
    return rows.map((r) => r.blockerId);
  }
}
