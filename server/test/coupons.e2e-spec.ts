import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, futureSlot, markVerified, rnd, signupUser } from './helpers';

/** Phase 7 — Silver coupon redemption. */
describe('coupons (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerAccess = '';
  let businessId = '';
  let eventId = '';
  let attendee: Awaited<ReturnType<typeof signupUser>>;
  let attendeeCode = '';
  let activityCode = '';

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const email = `silver-${rnd()}@hudlgo.test`;
    const owner = await http().post('/auth/business/signup').send({ name: 'Silver Café', email, password: 'password123' }).expect(201);
    ownerAccess = owner.body.accessToken;
    await markVerified(app, email);
    const biz = await http()
      .post('/businesses/register')
      .set(auth(ownerAccess))
      .send({ name: `Silver Café ${rnd()}`, address: 'Maârif, Casablanca', contactEmail: email })
      .expect(201);
    businessId = biz.body.id;

    // Admin grants a Silver sponsorship (coupons are a Silver perk).
    const admin = await http().post('/auth/login').send({ email: 'you@jmaa.app', password: 'password123' }).expect(201);
    await http()
      .post(`/admin/businesses/${businessId}/sponsorship`)
      .set(auth(admin.body.accessToken))
      .send({ action: 'grant', tier: 'silver', months: 1 })
      .expect(201);

    // The business hosts at its own venue → live instantly, with a coupon code.
    const ev = await http()
      .post('/events')
      .set(auth(ownerAccess))
      .send({
        activityId: 'coffee',
        title: 'Silver coffee',
        locationLabel: 'Silver Café',
        address: 'Maârif, Casablanca',
        lat: 33.58,
        lng: -7.63,
        isPublicPlace: true,
        businessId,
        ...futureSlot(2),
        maxAttendees: 6,
      })
      .expect(201);
    eventId = ev.body.id;
    const usage = await prisma.activityVenue.findFirstOrThrow({ where: { activityId: eventId } });
    activityCode = usage.couponCode!;
    expect(activityCode).toMatch(/^HUDLGO-[A-Z0-9]{6}$/);

    // Move it to tomorrow so today is inside the redeem window (activity day ± 1).
    const tomorrow = new Date(Date.now() + 86_400_000);
    await prisma.event.update({
      where: { id: eventId },
      data: { startsAt: tomorrow, endsAt: new Date(tomorrow.getTime() + 2 * 3_600_000) },
    });

    attendee = await signupUser(app, { name: 'Coupon Fan' });
    await http().post(`/events/${eventId}/join`).set(auth(attendee.access)).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('only joined attendees see their personal coupon', async () => {
    const res = await http().get(`/events/${eventId}`).set(auth(attendee.access)).expect(200);
    attendeeCode = res.body.coupon.code;
    expect(attendeeCode).toMatch(new RegExp(`^${activityCode}-[2-9A-HJ-NP-Z]{4}$`));
    expect(res.body.coupon.redeemable).toBe(true);

    const outsider = await signupUser(app);
    const other = await http().get(`/events/${eventId}`).set(auth(outsider.access)).expect(200);
    expect(other.body.coupon).toBeUndefined();
  });

  it('the business sets the offer text attendees see', async () => {
    await http().patch('/businesses/mine').set(auth(ownerAccess)).send({ couponOffer: 'Free mint tea with any pastry' }).expect(200);
    const res = await http().get(`/events/${eventId}`).set(auth(attendee.access)).expect(200);
    expect(res.body.coupon.offer).toBe('Free mint tea with any pastry');
  });

  it('lookup explains bad codes and needs the attendee suffix', async () => {
    const bad = await http().get(`/businesses/${businessId}/coupons/lookup?code=nope`).set(auth(ownerAccess)).expect(200);
    expect(bad.body).toMatchObject({ ok: false, problem: 'INVALID_CODE' });
    const partial = await http()
      .get(`/businesses/${businessId}/coupons/lookup?code=${encodeURIComponent(activityCode)}`)
      .set(auth(ownerAccess))
      .expect(200);
    expect(partial.body).toMatchObject({ ok: false, problem: 'NEED_ATTENDEE_CODE' });
    const wrong = await http()
      .get(`/businesses/${businessId}/coupons/lookup?code=${activityCode}-ZZZZ`)
      .set(auth(ownerAccess))
      .expect(200);
    expect(wrong.body.problem).toBe('NOT_FOUND');
  });

  it('only staff of the business can check coupons', async () => {
    const outsider = await signupUser(app);
    await http().get(`/businesses/${businessId}/coupons/lookup?code=${attendeeCode}`).set(auth(outsider.access)).expect(403);
    await http().post(`/businesses/${businessId}/coupons/redeem`).set(auth(outsider.access)).send({ code: attendeeCode }).expect(403);
  });

  it('a valid code shows the attendee and redeems exactly once (lower-case/spaces tolerated)', async () => {
    const look = await http()
      .get(`/businesses/${businessId}/coupons/lookup?code=${encodeURIComponent(attendeeCode.toLowerCase().replace(/-/g, ' '))}`)
      .set(auth(ownerAccess))
      .expect(200);
    expect(look.body).toMatchObject({ ok: true, attendee: { id: attendee.id, name: 'Coupon Fan' }, activity: { id: eventId } });

    const redeem = await http().post(`/businesses/${businessId}/coupons/redeem`).set(auth(ownerAccess)).send({ code: attendeeCode }).expect(201);
    expect(redeem.body.redeemedAt).toBeDefined();
    const again = await http().post(`/businesses/${businessId}/coupons/redeem`).set(auth(ownerAccess)).send({ code: attendeeCode }).expect(409);
    expect(again.body.code).toBe('COUPON_ALREADY_REDEEMED');

    const mine = await http().get('/businesses/mine').set(auth(ownerAccess)).expect(200);
    expect(mine.body.activities.find((a: { id: string }) => a.id === eventId).redemptions).toBe(1);
    const ev = await http().get(`/events/${eventId}`).set(auth(attendee.access)).expect(200);
    expect(ev.body.coupon.redeemedAt).toBeDefined();
  });

  it('refuses redemption outside the activity day ± 1', async () => {
    const late = await signupUser(app, { name: 'Late Fan' });
    await http().post(`/events/${eventId}/join`).set(auth(late.access)).expect(201);
    const code = (await http().get(`/events/${eventId}`).set(auth(late.access)).expect(200)).body.coupon.code;
    const in3days = new Date(Date.now() + 3 * 86_400_000);
    await prisma.event.update({ where: { id: eventId }, data: { startsAt: in3days, endsAt: new Date(in3days.getTime() + 3_600_000) } });
    const res = await http().post(`/businesses/${businessId}/coupons/redeem`).set(auth(ownerAccess)).send({ code }).expect(400);
    expect(res.body.code).toBe('COUPON_OUT_OF_WINDOW');
  });
});
