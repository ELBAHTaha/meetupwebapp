import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RatingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrustService } from '../trust/trust.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { publicUser, userPublicInclude } from '../common/serializers/user.serializer';

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
  ) {}

  async submit(eventId: string, fromUserId: string, dto: CreateRatingDto): Promise<unknown> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { attendances: { select: { userId: true } } },
    });
    if (!event) throw new NotFoundException('Activity not found.');
    if (new Date(event.endsAt) > new Date()) throw new BadRequestException('You can rate after the activity ends.');

    const isHost = event.hostId === fromUserId;
    const isAttendee = event.attendances.some((a) => a.userId === fromUserId);
    if (!isHost && !isAttendee) throw new ForbiddenException('Only participants can rate this activity.');

    let type: RatingType;
    if (isHost) {
      if (!event.attendances.some((a) => a.userId === dto.toUserId)) {
        throw new BadRequestException('You can only rate attendees of your activity.');
      }
      type = 'HOST_TO_ATTENDEE';
    } else {
      if (dto.toUserId !== event.hostId) throw new BadRequestException('Attendees rate the host.');
      type = 'ATTENDEE_TO_HOST';
    }
    if (dto.toUserId === fromUserId) throw new BadRequestException('You cannot rate yourself.');

    const existing = await this.prisma.rating.findUnique({
      where: { eventId_fromUserId_toUserId: { eventId, fromUserId, toUserId: dto.toUserId } },
    });
    if (existing) throw new BadRequestException('You already rated this person for this activity.');

    const rating = await this.prisma.rating.create({
      data: { eventId, fromUserId, toUserId: dto.toUserId, score: dto.score, comment: dto.comment?.trim() || null, type },
    });

    // A 1–2★ rating raises a flag (one per distinct event).
    if (dto.score <= 2) {
      await this.prisma.flag.create({
        data: {
          userId: dto.toUserId,
          eventId,
          ratingId: rating.id,
          reason: `Low rating (${dto.score}★) at "${event.title}"`,
        },
      });
    }
    await this.trust.recompute(dto.toUserId);

    return { id: rating.id, score: rating.score, type: rating.type };
  }

  /** Who/what the current user still needs to rate for this event. */
  async pending(eventId: string, userId: string): Promise<{ user: unknown; type: RatingType }[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { attendances: { select: { userId: true } } },
    });
    if (!event) throw new NotFoundException('Activity not found.');
    if (new Date(event.endsAt) > new Date()) return [];

    const isHost = event.hostId === userId;
    const targetIds = isHost ? event.attendances.map((a) => a.userId) : event.hostId === userId ? [] : [event.hostId];
    if (!isHost && !event.attendances.some((a) => a.userId === userId)) return [];

    const already = await this.prisma.rating.findMany({
      where: { eventId, fromUserId: userId },
      select: { toUserId: true },
    });
    const done = new Set(already.map((r) => r.toUserId));
    const toRate = targetIds.filter((id) => !done.has(id) && id !== userId);
    if (toRate.length === 0) return [];

    const users = await this.prisma.user.findMany({ where: { id: { in: toRate } }, include: userPublicInclude });
    const type: RatingType = isHost ? 'HOST_TO_ATTENDEE' : 'ATTENDEE_TO_HOST';
    return users.map((u) => ({ user: publicUser(u), type }));
  }

  /** Public written reviews left for a user (ratings that include a comment). */
  async reviewsFor(userId: string): Promise<unknown[]> {
    const ratings = await this.prisma.rating.findMany({
      where: { toUserId: userId, comment: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { fromUser: { include: userPublicInclude } },
    });
    return ratings.map((r) => {
      const from = publicUser(r.fromUser) as { name: string; avatar: string };
      return {
        id: r.id,
        eventId: r.eventId,
        fromUserId: r.fromUserId,
        toUserId: r.toUserId,
        rating: r.score,
        text: r.comment ?? '',
        createdAt: r.createdAt.toISOString(),
        fromName: from.name,
        fromAvatar: from.avatar,
      };
    });
  }
}
