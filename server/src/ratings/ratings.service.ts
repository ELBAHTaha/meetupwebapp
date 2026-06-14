import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RatingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { publicUser, userPublicInclude } from '../common/serializers/user.serializer';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recompute a user's trust score (avg received) and distinct-event flag count. */
  private async recomputeTrust(userId: string): Promise<void> {
    const received = await this.prisma.rating.findMany({ where: { toUserId: userId }, select: { score: true } });
    const trust = received.length ? received.reduce((s, r) => s + r.score, 0) / received.length : 5.0;
    const flags = await this.prisma.flag.findMany({ where: { userId }, select: { eventId: true } });
    const flagCount = new Set(flags.map((f) => f.eventId)).size;
    await this.prisma.user.update({
      where: { id: userId },
      data: { trustScore: new Prisma.Decimal(trust.toFixed(2)), flagCount },
    });
  }

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
      data: { eventId, fromUserId, toUserId: dto.toUserId, score: dto.score, type },
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
    await this.recomputeTrust(dto.toUserId);

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
}
