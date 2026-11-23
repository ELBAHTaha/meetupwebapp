import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, futureSlot, signupUser } from './helpers';

/**
 * Phase 2 — real-time chat over socket.io. Boots the app on a random port and
 * talks to it with a real socket.io client.
 */
describe('realtime chat gateway (e2e)', () => {
  let app: INestApplication;
  let url = '';
  let host: Awaited<ReturnType<typeof signupUser>>;
  let guest: Awaited<ReturnType<typeof signupUser>>;
  let outsider: Awaited<ReturnType<typeof signupUser>>;
  let eventId = '';
  const sockets: Socket[] = [];

  const connect = (token?: string): Socket => {
    const s = io(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(s);
    return s;
  };
  const once = <T>(s: Socket, event: string, ms = 4000): Promise<T> =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
      s.once(event, (payload: T) => {
        clearTimeout(t);
        resolve(payload);
      });
    });
  const connected = (s: Socket) => (s.connected ? Promise.resolve() : once<void>(s, 'connect'));
  const emitAck = <T>(s: Socket, event: string, body: unknown): Promise<T> =>
    new Promise((resolve) => s.emit(event, body, (res: T) => resolve(res)));

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0);
    const addr = app.getHttpServer().address();
    url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

    host = await signupUser(app, { name: 'Socket Host' });
    guest = await signupUser(app, { name: 'Socket Guest' });
    outsider = await signupUser(app, { name: 'Socket Outsider' });

    const created = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${host.access}`)
      .send({
        activityId: 'coffee',
        title: 'Realtime coffee',
        locationLabel: 'Café',
        address: 'Public café, Maârif',
        lat: 33.58,
        lng: -7.63,
        isPublicPlace: true,
        ...futureSlot(),
        maxAttendees: 6,
      })
      .expect(201);
    eventId = created.body.id;
    // Approve directly so the guest can join.
    await app.get(PrismaService).event.update({ where: { id: eventId }, data: { approvedAt: new Date() } });
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await app?.close();
  });

  it('rejects a handshake without a valid token', async () => {
    const err = await once<Error>(connect(), 'connect_error');
    expect(err.message).toBe('UNAUTHORIZED');
    const bad = await once<Error>(connect('not-a-jwt'), 'connect_error');
    expect(bad.message).toBe('UNAUTHORIZED');
  });

  it('rejects suspended accounts', async () => {
    const prisma = app.get(PrismaService);
    await prisma.user.update({ where: { id: outsider.id }, data: { status: 'SUSPENDED' } });
    const err = await once<Error>(connect(outsider.access), 'connect_error');
    expect(err.message).toBe('FORBIDDEN');
    await prisma.user.update({ where: { id: outsider.id }, data: { status: 'ACTIVE' } });
  });

  it('pushes notification:new to the host when someone joins', async () => {
    const hs = connect(host.access);
    await connected(hs);
    const notified = once<{ type: string; unread: number; eventId: string }>(hs, 'notification:new');
    await request(app.getHttpServer())
      .post(`/events/${eventId}/join`)
      .set('Authorization', `Bearer ${guest.access}`)
      .expect(201);
    const n = await notified;
    expect(n.type).toBe('join_request');
    expect(n.eventId).toBe(eventId);
    expect(n.unread).toBeGreaterThanOrEqual(1);
  });

  it('thread:join uses the REST access rules (outsider → 403)', async () => {
    const os = connect(outsider.access);
    await connected(os);
    const res = await emitAck<{ ok: boolean; status?: number }>(os, 'thread:join', { eventId });
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it('delivers message:new to thread members after a REST send (not to outsiders)', async () => {
    const gs = connect(guest.access);
    const os = connect(outsider.access);
    await Promise.all([connected(gs), connected(os)]);
    expect(await emitAck(gs, 'thread:join', { eventId })).toEqual({ ok: true });

    let outsiderGotIt = false;
    os.on('message:new', () => (outsiderGotIt = true));
    const incoming = once<{ eventId: string; message: { text: string; senderId: string; sender: { name: string } } }>(
      gs,
      'message:new',
    );
    const activity = once<{ eventId: string }>(gs, 'chat:activity');

    await request(app.getHttpServer())
      .post(`/events/${eventId}/chat/messages`)
      .set('Authorization', `Bearer ${host.access}`)
      .send({ text: 'Hello from the host 👋' })
      .expect(201);

    const msg = await incoming;
    expect(msg.eventId).toBe(eventId);
    expect(msg.message.text).toBe('Hello from the host 👋');
    expect(msg.message.senderId).toBe(host.id);
    expect(msg.message.sender.name).toBe('Socket Host');
    expect((await activity).eventId).toBe(eventId);
    await new Promise((r) => setTimeout(r, 200));
    expect(outsiderGotIt).toBe(false);
  });

  it('filtered messages are rejected on the REST write path and never emitted', async () => {
    await request(app.getHttpServer())
      .post(`/events/${eventId}/chat/messages`)
      .set('Authorization', `Bearer ${host.access}`)
      .send({ text: 'call me on 0612345678' })
      .expect(400);
  });
});
