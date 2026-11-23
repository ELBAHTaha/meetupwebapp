import { HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService, threadRoom, userRoom } from '../realtime/realtime.service';
import type { JwtPayload } from '../auth/tokens.service';
import { ChatService } from './chat.service';

/** What we keep on an authenticated socket (`socket.data.user`). */
interface SocketUser {
  id: string;
  role: string;
}

type Ack = { ok: true } | { ok: false; status: number; error: string };

/**
 * Real-time chat + notification push (socket.io, default `/socket.io` path).
 *
 * - The handshake must carry a valid JWT access token (`auth: { token }`);
 *   suspended/banned/deleted accounts are refused with `UNAUTHORIZED`/`FORBIDDEN`.
 * - Each socket joins its `user:<id>` room (notifications, chat-list updates).
 * - `thread:join { eventId }` subscribes to a group chat after the SAME access
 *   check as the REST endpoints (ChatService.assertCanView).
 * - Writes stay on REST (`POST /events/:id/chat/messages`): ChatService emits
 *   `message:new` after the message filter + email-verified guard have passed.
 */
@SkipThrottle()
@WebSocketGateway()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
    server.use((socket, next) => {
      this.authenticate(socket)
        .then((user) => {
          (socket.data as { user?: SocketUser }).user = user;
          next();
        })
        .catch((err: Error) => next(err));
    });
  }

  handleConnection(client: Socket): void {
    const user = (client.data as { user?: SocketUser }).user;
    if (!user) {
      client.disconnect(true);
      return;
    }
    void client.join(userRoom(user.id));
  }

  private async authenticate(socket: Socket): Promise<SocketUser> {
    const auth = (socket.handshake.auth ?? {}) as { token?: unknown };
    const header = socket.handshake.headers.authorization;
    const token =
      typeof auth.token === 'string'
        ? auth.token
        : typeof header === 'string' && header.startsWith('Bearer ')
          ? header.slice(7)
          : undefined;
    if (!token) throw new Error('UNAUTHORIZED');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.accessSecret', 'dev-access-secret'),
      });
    } catch {
      throw new Error('UNAUTHORIZED'); // expired/invalid → client refreshes and reconnects
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });
    if (!user) throw new Error('UNAUTHORIZED');
    if (user.status !== 'ACTIVE') throw new Error('FORBIDDEN');
    return { id: user.id, role: user.role };
  }

  @SubscribeMessage('thread:join')
  async joinThread(@ConnectedSocket() client: Socket, @MessageBody() body: { eventId?: unknown }): Promise<Ack> {
    const user = (client.data as { user?: SocketUser }).user;
    const eventId = typeof body?.eventId === 'string' ? body.eventId : '';
    if (!user) return { ok: false, status: 401, error: 'Unauthorized' };
    if (!eventId) return { ok: false, status: 400, error: 'eventId is required' };
    try {
      await this.chat.assertCanView(eventId, user.id);
      await client.join(threadRoom(eventId));
      return { ok: true };
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 500;
      if (status >= 500) this.logger.error(`thread:join failed: ${(err as Error).message}`);
      return { ok: false, status, error: (err as Error).message };
    }
  }

  @SubscribeMessage('thread:leave')
  async leaveThread(@ConnectedSocket() client: Socket, @MessageBody() body: { eventId?: unknown }): Promise<Ack> {
    if (typeof body?.eventId === 'string') await client.leave(threadRoom(body.eventId));
    return { ok: true };
  }
}
