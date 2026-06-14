import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import {
  categoryIn,
  colorTokenFor,
  serializeActivity,
  slugify,
  vibeIn,
} from '../common/serializers/activity.serializer';

@Injectable()
export class ActivityTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<unknown[]> {
    const types = await this.prisma.activityType.findMany({ orderBy: { name: 'asc' } });
    return types.map(serializeActivity);
  }

  /** Resolve a frontend slug-id to the DB row id (events reference the row). */
  async resolveId(slugOrId: string): Promise<string | null> {
    const t = await this.prisma.activityType.findFirst({
      where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
      select: { id: true },
    });
    return t?.id ?? null;
  }

  async createCustom(userId: string, dto: CreateActivityTypeDto): Promise<unknown> {
    const category = categoryIn(dto.group);
    let slug = slugify(dto.name);
    // Ensure uniqueness.
    if (await this.prisma.activityType.findUnique({ where: { slug } })) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    const type = await this.prisma.activityType.create({
      data: {
        name: dto.name,
        slug,
        icon: dto.lucideIcon || 'Sparkles',
        category,
        colorToken: colorTokenFor(category),
        outdoor: dto.outdoor ?? false,
        vibe: vibeIn(dto.vibe),
        isCustom: true,
        createdById: userId,
      },
    });
    return serializeActivity(type);
  }
}
