import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  eventId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async push(input: NotifyInput): Promise<void> {
    await this.prisma.notification.create({ data: input });
  }

  async pushMany(inputs: NotifyInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await this.prisma.notification.createMany({ data: inputs });
  }

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string): Promise<{ success: true }> {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: true }> {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { success: true };
  }
}
