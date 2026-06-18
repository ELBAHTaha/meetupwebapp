import { Injectable } from '@nestjs/common';
import { FeedbackCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto, FeedbackCategorySlug } from './dto/create-feedback.dto';

const CATEGORY_IN: Record<FeedbackCategorySlug, FeedbackCategory> = {
  idea: 'IDEA',
  bug: 'BUG',
  praise: 'PRAISE',
  other: 'OTHER',
};

const feedbackInclude = {
  user: { select: { id: true, name: true, photoUrl: true, email: true } },
} satisfies Prisma.FeedbackInclude;

type FeedbackWithUser = Prisma.FeedbackGetPayload<{ include: typeof feedbackInclude }>;

function serialize(f: FeedbackWithUser) {
  return {
    id: f.id,
    category: f.category.toLowerCase() as FeedbackCategorySlug,
    message: f.message,
    path: f.path ?? undefined,
    resolved: f.resolved,
    createdAt: f.createdAt.toISOString(),
    user: f.user ? { id: f.user.id, name: f.user.name, avatar: f.user.photoUrl ?? undefined, email: f.user.email } : undefined,
  };
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFeedbackDto, userId?: string): Promise<{ success: true }> {
    await this.prisma.feedback.create({
      data: {
        category: CATEGORY_IN[dto.category] ?? 'OTHER',
        message: dto.message.trim(),
        path: dto.path,
        ...(userId ? { user: { connect: { id: userId } } } : {}),
      },
    });
    return { success: true };
  }

  /** Admin: all feedback, newest first (unresolved first). */
  async list() {
    const rows = await this.prisma.feedback.findMany({
      include: feedbackInclude,
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return rows.map(serialize);
  }

  async resolve(id: string): Promise<{ success: true }> {
    await this.prisma.feedback.update({ where: { id }, data: { resolved: true } });
    return { success: true };
  }

  async openCount(): Promise<number> {
    return this.prisma.feedback.count({ where: { resolved: false } });
  }
}
