import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
        targetUserId: isUser ? dto.targetId : undefined,
        targetEventId: isUser ? undefined : dto.targetId,
        reason: dto.reason,
        chatThreadId,
        status: 'OPEN',
      },
    });
    return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
  }
}
