import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, futureSlot, signupUser } from './helpers';

/** Phase 6 — blocking users. */
describe('blocking (e2e)', () => {
  let app: INestApplication;
  let url = '';
  let host: Awaited<ReturnType<typeof signupUser>>;
  let blocker: Awaited<ReturnType<typeof signupUser>>;
  let attendedEventId = '';
  let otherEventId = '';
  const sockets: Socket[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function hostEvent(title: string, daysAhead: number): Promise<string> {
    const res = await http()
      .post('/events')
      .set(auth(host.access))
      .send({
        activityId: 'coffee',
        title,
        locationLabel: 'Café',
        address: 'Public café, Maârif',
        lat: 33.58,
        lng: -7.63,
        isPublicPlace: true,
        ...futureSlot(daysAhead),
        maxAttendees: 6,
      })
      .expect(201);
    await app.get(PrismaService).event.update({ where: { id: res.body.id }, data: { approvedAt: new Date() } });
    return res.body.id;
  }

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0);
    const addr = app.getHttpServer().address();
    url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    host = await signupUser(app, { name: 'Blocked Host' });
    blocker = await signupUser(app, { name: 'The Blocker' });
    // Pro host so the second activity isn't refused by the free daily quota.
    await app.get(PrismaService).user.update({
      where: { id: host.id },
      data: { subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionEndsAt: new Date(Date.now() + 30 * 86_400_000) },
    });
    attendedEventId = await hostEvent('Already joined coffee', 2);
    otherEventId = await hostEvent('Future coffee', 3);
    // The blocker joins one activity BEFORE blocking (that attendance is left alone).
    await http().post(`/events/${attendedEventId}/join`).set(auth(blocker.access)).expect(201);
    await http().post(`/events/${attendedEventId}/chat/messages`).set(auth(host.access)).send({ text: 'Before the block' }).expect(201);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await app?.close();
  });

  it('validates block requests', async () => {
    await http().post(`/users/${blocker.id}/block`).set(auth(blocker.access)).expect(400);
    await http().post('/users/does-not-exist/block').set(auth(blocker.access)).expect(404);
  });

  it('blocks a user and lists them', async () => {
    await http().post(`/users/${host.id}/block`).set(auth(blocker.access)).expect(201);
    await http().post(`/users/${host.id}/block`).set(auth(blocker.access)).expect(201); // idempotent
    const list = await http().get('/users/me/blocks').set(auth(blocker.access)).expect(200);
    expect(list.body.map((u: { id: string }) => u.id)).toEqual([host.id]);
  });

  it('hides profiles from each other (404 both ways)', async () => {
    await http().get(`/users/${host.id}`).set(auth(blocker.access)).expect(404);
    await http().get(`/users/${blocker.id}`).set(auth(host.access)).expect(404);
    await http().get(`/users/${host.id}`).expect(200); // anonymous visitors unaffected
  });

  it('hides the host’s activities from the feed and detail, and refuses new joins', async () => {
    const feed = await http().get('/events?limit=50').set(auth(blocker.access)).expect(200);
    expect(feed.body.items.some((e: { id: string }) => e.id === otherEventId)).toBe(false);
    await http().get(`/events/${otherEventId}`).set(auth(blocker.access)).expect(404);
    const join = await http().post(`/events/${otherEventId}/join`).set(auth(blocker.access)).expect(403);
    expect(join.body.code).toBe('BLOCKED');
  });

  it('leaves an existing attendance alone', async () => {
    await http().get(`/events/${attendedEventId}`).set(auth(blocker.access)).expect(200);
    const a = await app.get(PrismaService).attendance.findFirst({ where: { eventId: attendedEventId, userId: blocker.id } });
    expect(a).not.toBeNull();
  });

  it('the blocked user can’t join the blocker’s activities either', async () => {
    // The blocker hosts something; the blocked host tries to join it.
    const res = await http()
      .post('/events')
      .set(auth(blocker.access))
      .send({
        activityId: 'coffee',
        title: 'Blocker’s coffee',
        locationLabel: 'Café',
        address: 'Public café, Gauthier',
        lat: 33.59,
        lng: -7.62,
        isPublicPlace: true,
        ...futureSlot(4),
        maxAttendees: 6,
      })
      .expect(201);
    await app.get(PrismaService).event.update({ where: { id: res.body.id }, data: { approvedAt: new Date() } });
    await http().post(`/events/${res.body.id}/join`).set(auth(host.access)).expect(403);
  });

  it('hides the blocked user’s chat messages from the blocker (history and live)', async () => {
    const thread = await http().get(`/events/${attendedEventId}/chat`).set(auth(blocker.access)).expect(200);
    expect(thread.body.messages.some((m: { senderId: string }) => m.senderId === host.id)).toBe(false);

    const s = io(url, { auth: { token: blocker.access }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(s);
    await new Promise<void>((resolve) => s.once('connect', () => resolve()));
    await new Promise((resolve) => s.emit('thread:join', { eventId: attendedEventId }, resolve));
    let received = false;
    s.on('message:new', () => (received = true));
    await http().post(`/events/${attendedEventId}/chat/messages`).set(auth(host.access)).send({ text: 'After the block' }).expect(201);
    await new Promise((r) => setTimeout(r, 400));
    expect(received).toBe(false);
  });

  it('unblocking restores visibility', async () => {
    await http().delete(`/users/${host.id}/block`).set(auth(blocker.access)).expect(200);
    await http().get(`/users/${host.id}`).set(auth(blocker.access)).expect(200);
    await http().get(`/events/${otherEventId}`).set(auth(blocker.access)).expect(200);
    const thread = await http().get(`/events/${attendedEventId}/chat`).set(auth(blocker.access)).expect(200);
    expect(thread.body.messages.filter((m: { senderId: string }) => m.senderId === host.id)).toHaveLength(2);
  });
});
