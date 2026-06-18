import { BadRequestException, ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { messageViolation } from '../common/utils/message-filter';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /** Host + joined/waitlisted attendees only. Throws 403/410 otherwise. Returns the event. */
  private async authorize(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { chatThread: true, attendances: { select: { userId: true } } },
    });
    if (!event || !event.chatThread) throw new NotFoundException('Chat not found.');
    const isParticipant = event.hostId === userId || event.attendances.some((a) => a.userId === userId);
    if (!isParticipant) throw new ForbiddenException('Only attendees can view this group chat.');
    if (event.chatThread.expiresAt < new Date()) {
      throw new GoneException('This group chat has closed (24h after the meetup).');
    }
    return event;
  }

  async getThread(eventId: string, userId: string): Promise<unknown> {
    const event = await this.authorize(eventId, userId);
    const thread = event.chatThread!;
    const ended = new Date(event.endsAt) < new Date();
    const messages = await this.prisma.chatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { sentAt: 'asc' },
      include: { sender: { select: { id: true, name: true, photoUrl: true } } },
    });
    return {
      id: thread.id,
      eventId,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      ended, // true once the activity has finished — chat becomes read-only
      expiresAt: thread.expiresAt.toISOString(),
      participantIds: await this.participantIds(eventId),
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        text: m.text,
        sentAt: m.sentAt.toISOString(),
      })),
    };
  }

  async sendMessage(eventId: string, userId: string, text: string): Promise<unknown> {
    const violation = messageViolation(text);
    if (violation) throw new BadRequestException(violation);
    const event = await this.authorize(eventId, userId);
    // Once the activity has ended, the chat is read-only for everyone.
    if (new Date(event.endsAt) < new Date()) {
      throw new ForbiddenException('This activity has ended — the chat is now read-only.');
    }
    const msg = await this.prisma.chatMessage.create({
      data: { threadId: event.chatThread!.id, senderId: userId, text: text.slice(0, 2000) },
    });
    return { id: msg.id, senderId: msg.senderId, text: msg.text, sentAt: msg.sentAt.toISOString() };
  }

  private async participantIds(eventId: string): Promise<string[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { attendances: { select: { userId: true } } },
    });
    if (!event) return [];
    return [event.hostId, ...event.attendances.map((a) => a.userId)];
  }
}
