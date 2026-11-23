import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Room naming — one room per user (all their tabs/devices) and per chat thread. */
export const userRoom = (userId: string): string => `user:${userId}`;
export const threadRoom = (eventId: string): string => `thread:${eventId}`;

/**
 * Thin emitter over the socket.io server. Services depend on this (not on the
 * gateway) so there's no circular dependency; the gateway attaches the server
 * once it initializes. Every method is a safe no-op before that (e.g. in
 * scripts or unit tests without a websocket server).
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server?: Server;

  attach(server: Server): void {
    this.server = server;
  }

  /** Emit to every socket of the given users. */
  toUsers(userIds: string[], event: string, payload: unknown): void {
    if (!this.server || userIds.length === 0) return;
    this.server.to([...new Set(userIds)].map(userRoom)).emit(event, payload);
  }

  /** Emit to a chat-thread room, optionally skipping some users' sockets (e.g. blockers). */
  toThread(eventId: string, event: string, payload: unknown, exceptUserIds: string[] = []): void {
    if (!this.server) return;
    let op = this.server.to(threadRoom(eventId));
    if (exceptUserIds.length) op = op.except(exceptUserIds.map(userRoom));
    op.emit(event, payload);
  }

  /** Force-disconnect a user's sockets (ban/suspension). */
  disconnectUser(userId: string): void {
    if (!this.server) return;
    try {
      this.server.in(userRoom(userId)).disconnectSockets(true);
    } catch (err) {
      this.logger.warn(`disconnectUser failed: ${(err as Error).message}`);
    }
  }
}
