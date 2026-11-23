import { BadRequestException, ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { messageViolation } from '../common/utils/message-filter';
import { avatarFor } from '../common/serializers/user.serializer';

type MessageWithSender = {
  id: string;
  senderId: string;
  text: string;
  sentAt: Date;
  sender: { id: string; name: string; photoUrl: string | null };
};

/** Wire shape of a chat message (REST + socket `message:new`). */
export function serializeMessage(m: MessageWithSender) {
  return {
    id: m.id,
    senderId: m.senderId,
    text: m.text,
    sentAt: m.sentAt.toISOString(),
    sender: { id: m.sender.id, name: m.sender.name, avatar: avatarFor(m.sender) },
  };
}

const senderSelect = { select: { id: true, name: true, photoUrl: true } } as const;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * The single access rule for a group chat (REST and websocket): host +
   * joined/waitlisted attendees only, and only until the thread expires (24h
   * after the meetup). Throws 404/403/410 otherwise. Returns the event.
   */
  async assertCanView(eventId: string, userId: string) {
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
    const event = await this.assertCanView(eventId, userId);
    const thread = event.chatThread!;
    const ended = new Date(event.endsAt) < new Date();
    const messages = await this.prisma.chatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { sentAt: 'asc' },
      include: { sender: senderSelect },
    });
    return {
      id: thread.id,
      eventId,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      ended, // true once the activity has finished — chat becomes read-only
      expiresAt: thread.expiresAt.toISOString(),
      participantIds: [event.hostId, ...event.attendances.map((a) => a.userId)],
      messages: messages.map(serializeMessage),
    };
  }

  /**
   * The single write path for chat messages. Runs the message filter (the
   * email-verified rule is enforced by the controller guard), persists, then
   * pushes `message:new` to the thread room and `chat:activity` to every
   * participant (drives the chat list's latest message / unread dot).
   */
  async sendMessage(eventId: string, userId: string, text: string): Promise<unknown> {
    const violation = messageViolation(text);
    if (violation) throw new BadRequestException(violation);
    const event = await this.assertCanView(eventId, userId);
    // Once the activity has ended, the chat is read-only for everyone.
    if (new Date(event.endsAt) < new Date()) {
      throw new ForbiddenException('This activity has ended — the chat is now read-only.');
    }
    const msg = await this.prisma.chatMessage.create({
      data: { threadId: event.chatThread!.id, senderId: userId, text: text.slice(0, 2000) },
      include: { sender: senderSelect },
    });
    const out = serializeMessage(msg);
    const participants = [event.hostId, ...event.attendances.map((a) => a.userId)];
    this.realtime.toThread(eventId, 'message:new', { eventId, message: out });
    this.realtime.toUsers(participants, 'chat:activity', { eventId, message: out });
    return out;
  }
}
