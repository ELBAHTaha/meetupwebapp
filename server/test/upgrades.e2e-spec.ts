import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { createApp, futureSlot, rnd, signupUser } from './helpers';

/** Phase 4 — manual, admin-granted plans (no payment gateway). */
describe('manual upgrades (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAccess = '';
  let adminId = '';

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const monthsFromNow = (d: string | Date, months: number) => {
    const target = new Date();
    target.setMonth(target.getMonth() + months);
    return Math.abs(new Date(d).getTime() - target.getTime()) < 2 * 86_400_000;
  };
  const eventBody = (title: string, extra: Record<string, unknown> = {}) => ({
    activityId: 'coffee',
    title,
    locationLabel: 'Café',
    address: 'Public café, Maârif',
    lat: 33.58,
    lng: -7.63,
    isPublicPlace: true,
    ...futureSlot(3),
    maxAttendees: 6,
    ...extra,
  });

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const admin = await http().post('/auth/login').send({ email: 'you@jmaa.app', password: 'password123' }).expect(201);
    adminAccess = admin.body.accessToken;
    adminId = admin.body.user.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Pro Host request → admin approval', () => {
    let user: Awaited<ReturnType<typeof signupUser>>;
    let requestId = '';

    beforeAll(async () => {
      user = await signupUser(app);
    });

    it('creates a pending request with a reference and payment instructions', async () => {
      const res = await http().post('/upgrades').set(auth(user.access)).send({ product: 'pro_host', interval: 'monthly' }).expect(201);
      expect(res.body.status).toBe('pending');
      expect(res.body.reference).toMatch(/^HG-[2-9A-HJ-NP-Z]{5}$/);
      expect(res.body.amountCents).toBe(4900);
      expect(res.body.instructions).toContain(res.body.reference);
      expect(res.body.instructions).toContain('49');
      requestId = res.body.id;

      // Asking again returns the same pending request (idempotent).
      const again = await http().post('/upgrades').set(auth(user.access)).send({ product: 'pro_host' }).expect(201);
      expect(again.body.id).toBe(requestId);

      const mine = await http().get('/upgrades/mine').set(auth(user.access)).expect(200);
      expect(mine.body[0].id).toBe(requestId);
    });

    it('admin endpoints are admin-only', async () => {
      await http().get('/admin/upgrade-requests').set(auth(user.access)).expect(403);
      await http().post(`/admin/upgrade-requests/${requestId}/approve`).set(auth(user.access)).send({}).expect(403);
    });

    it('approving grants Pro for the requested term and writes the audit log', async () => {
      const list = await http().get('/admin/upgrade-requests').set(auth(adminAccess)).expect(200);
      expect(list.body.find((r: { id: string }) => r.id === requestId)?.status).toBe('pending');

      const res = await http().post(`/admin/upgrade-requests/${requestId}/approve`).set(auth(adminAccess)).send({}).expect(201);
      expect(res.body.status).toBe('approved');
      expect(monthsFromNow(res.body.grantedUntil, 1)).toBe(true);

      const summary = await http().get('/subscriptions/me').set(auth(user.access)).expect(200);
      expect(summary.body.plan).toBe('pro');
      expect(summary.body.remaining).toBe('unlimited');

      const audit = await prisma.subscriptionEvent.findFirst({ where: { userId: user.id, eventType: 'grant_pro' } });
      expect(audit?.adminId).toBe(adminId);

      // Already decided → can't approve twice.
      await http().post(`/admin/upgrade-requests/${requestId}/approve`).set(auth(adminAccess)).send({}).expect(400);
    });

    it('users can cancel their own pending requests only', async () => {
      const res = await http().post('/upgrades').set(auth(user.access)).send({ product: 'pro_host', interval: 'annual' }).expect(201);
      expect(res.body.amountCents).toBe(Math.round(4900 * 12 * 0.85));
      const other = await signupUser(app);
      await http().post(`/upgrades/${res.body.id}/cancel`).set(auth(other.access)).expect(404);
      await http().post(`/upgrades/${res.body.id}/cancel`).set(auth(user.access)).expect(201);
      await http().post(`/upgrades/${res.body.id}/cancel`).set(auth(user.access)).expect(400);
    });

    it('admins can extend and revoke directly', async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      const ext = await http().post(`/admin/users/${user.id}/plan`).set(auth(adminAccess)).send({ action: 'extend', months: 2 }).expect(201);
      expect(new Date(ext.body.endsAt).getTime()).toBeGreaterThan(before.subscriptionEndsAt!.getTime() + 50 * 86_400_000);

      const rev = await http().post(`/admin/users/${user.id}/plan`).set(auth(adminAccess)).send({ action: 'revoke' }).expect(201);
      expect(rev.body.plan).toBe('free');
      expect(await prisma.subscriptionEvent.count({ where: { userId: user.id, eventType: 'revoke_pro', adminId } })).toBe(1);
    });
  });

  describe('extra pinned activity (create now, live when paid)', () => {
    let host: Awaited<ReturnType<typeof signupUser>>;
    let extraId = '';
    let pinRequestId = '';

    beforeAll(async () => {
      host = await signupUser(app);
      await http().post('/events').set(auth(host.access)).send(eventBody('Free coffee')).expect(201);
    });

    it('over the free quota, a plain create is refused', async () => {
      await http().post('/events').set(auth(host.access)).send(eventBody('Second coffee')).expect(400);
    });

    it('with a pin request it is saved hidden, awaiting payment', async () => {
      const res = await http()
        .post('/events')
        .set(auth(host.access))
        .send(eventBody('Extra coffee', { priorityLevel: 'priority' }))
        .expect(201);
      expect(res.body.awaitingPayment).toBe(true);
      expect(res.body.upgradeRequest?.product).toBe('pinned_activity');
      expect(res.body.upgradeRequest?.amountCents).toBe(1990);
      extraId = res.body.id;
      pinRequestId = res.body.upgradeRequest.id;

      const pending = await http().get('/admin/pending-activities').set(auth(adminAccess)).expect(200);
      expect(pending.body.some((e: { id: string }) => e.id === extraId)).toBe(false);
      await http().post(`/admin/activities/${extraId}/approve`).set(auth(adminAccess)).expect(400);
    });

    it('approving the request publishes it and pins it until it starts', async () => {
      await http().post(`/admin/upgrade-requests/${pinRequestId}/approve`).set(auth(adminAccess)).send({}).expect(201);
      const e = await prisma.event.findUniqueOrThrow({ where: { id: extraId } });
      expect(e.awaitingPayment).toBe(false);
      expect(e.approvedAt).not.toBeNull();
      expect(e.pinnedUntil?.getTime()).toBe(e.startsAt.getTime());
      expect(e.priorityLevel).toBe('PRIORITY');
    });

    it('rejecting a pending extra activity cancels it', async () => {
      const res = await http()
        .post('/events')
        .set(auth(host.access))
        .send(eventBody('Another extra', { priorityLevel: 'priority' }))
        .expect(201);
      await http()
        .post(`/admin/upgrade-requests/${res.body.upgradeRequest.id}/reject`)
        .set(auth(adminAccess))
        .send({ adminNote: 'No payment received' })
        .expect(201);
      const e = await prisma.event.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(e.status).toBe('CANCELLED');
    });
  });

  describe('business sponsorship', () => {
    let ownerAccess = '';
    let businessId = '';

    beforeAll(async () => {
      const email = `biz-${rnd()}@hudlgo.test`;
      const owner = await http()
        .post('/auth/business/signup')
        .send({ name: 'Upgrade Café', email, password: 'password123' })
        .expect(201);
      ownerAccess = owner.body.accessToken;
      const biz = await http()
        .post('/businesses/register')
        .set(auth(ownerAccess))
        .send({ name: `Upgrade Café ${rnd()}`, address: 'Gauthier, Casablanca', contactEmail: email })
        .expect(201);
      businessId = biz.body.id;
    });

    it('business accounts cannot request Pro Host', async () => {
      await http().post('/upgrades').set(auth(ownerAccess)).send({ product: 'pro_host' }).expect(403);
    });

    it('a quarterly Silver request is priced with the prepaid discount and grants 3 months', async () => {
      const req = await http()
        .post('/upgrades')
        .set(auth(ownerAccess))
        .send({ product: 'sponsorship_silver', interval: 'quarterly', businessId })
        .expect(201);
      expect(req.body.amountCents).toBe(Math.round(99000 * 3 * 0.9));

      const outsider = await signupUser(app);
      await http()
        .post('/upgrades')
        .set(auth(outsider.access))
        .send({ product: 'sponsorship_silver', businessId })
        .expect(403);

      await http().post(`/admin/upgrade-requests/${req.body.id}/approve`).set(auth(adminAccess)).send({}).expect(201);
      const s = await prisma.sponsorship.findFirstOrThrow({ where: { businessId, status: 'ACTIVE' } });
      expect(s.tier).toBe('SILVER');
      expect(monthsFromNow(s.endDate!, 3)).toBe(true);
      const b = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
      expect(b.status).toBe('VERIFIED');
    });

    it('admin can revoke the sponsorship directly', async () => {
      await http().post(`/admin/businesses/${businessId}/sponsorship`).set(auth(adminAccess)).send({ action: 'revoke' }).expect(201);
      expect(await prisma.sponsorship.count({ where: { businessId, status: 'ACTIVE' } })).toBe(0);
    });
  });

  describe('scheduler', () => {
    it('expires lapsed plans and sends one renewal reminder ~5 days ahead', async () => {
      const scheduler = app.get(SchedulerService);
      const lapsed = await signupUser(app);
      const soon = await signupUser(app);
      await prisma.user.update({
        where: { id: lapsed.id },
        data: { subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionEndsAt: new Date(Date.now() - 60_000) },
      });
      await prisma.user.update({
        where: { id: soon.id },
        data: { subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionEndsAt: new Date(Date.now() + 4 * 86_400_000) },
      });

      await scheduler.expireLapsedPlans();
      const l = await prisma.user.findUniqueOrThrow({ where: { id: lapsed.id } });
      expect(l.subscriptionPlan).toBe('FREE');
      expect(await prisma.subscriptionEvent.count({ where: { userId: lapsed.id, eventType: 'expire_pro' } })).toBe(1);

      await scheduler.renewalReminders();
      await scheduler.renewalReminders(); // idempotent
      const s = await prisma.user.findUniqueOrThrow({ where: { id: soon.id } });
      expect(s.planReminderSentAt).not.toBeNull();
      expect(await prisma.notification.count({ where: { userId: soon.id, type: 'upgrade' } })).toBe(1);
    });
  });
});
