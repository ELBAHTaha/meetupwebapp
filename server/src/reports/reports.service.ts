import { Injectable } from '@nestjs/common';
import { ReportReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrustService } from '../trust/trust.service';
import { CreateReportDto } from './dto/create-report.dto';

const REASON_MAP: Record<string, ReportReason> = {
  fake_activity: 'FAKE_ACTIVITY',
  inappropriate: 'INAPPROPRIATE',
  no_show_host: 'NO_SHOW_HOST',
  suspicious_user: 'SUSPICIOUS_USER',
  other: 'OTHER',
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<unknown> {
    const isUser = dto.targetType === 'user';
    // Only link the chat thread if it actually exists (frontend may pass a
    // synthetic id while running against the mock).
    let chatThreadId: string | undefined;
    if (dto.chatThreadId) {
      const t = await this.prisma.chatThread.findFirst({
        where: { OR: [{ id: dto.chatThreadId }, { eventId: dto.targetId }] },
        select: { id: true },
      });
      chatThreadId = t?.id;
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: isUser ? 'USER' : 'EVENT',
        category: REASON_MAP[dto.category ?? 'other'] ?? 'OTHER',
        targetUserId: isUser ? dto.targetId : undefined,
        targetEventId: isUser ? undefined : dto.targetId,
        reason: dto.reason,
        chatThreadId,
        status: 'OPEN',
      },
    });

    if (isUser) {
      await this.onUserReported(dto.targetId);
    } else {
      // Reported activities are hidden immediately, pending admin review.
      await this.prisma.event.update({ where: { id: dto.targetId }, data: { underReview: true } }).catch(() => undefined);
    }

    return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
  }

  /** Auto-flag + trust penalty once a user passes 3 distinct reporters. */
  private async onUserReported(userId: string): Promise<void> {
    const reports = await this.prisma.report.findMany({
      where: { targetType: 'USER', targetUserId: userId },
      select: { reporterId: true },
    });
    const distinctReporters = new Set(reports.map((r) => r.reporterId)).size;
    if (distinctReporters >= 3) {
      await this.prisma.user.update({ where: { id: userId }, data: { flagCount: { increment: 1 } } });
      // Reported penalty (spec −50 pts → −2.5 on the 0–5 scale).
      await this.trust.adjust(userId, -2.5, 'reported (≥3 distinct reporters)');
    }
  }
}
