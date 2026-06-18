import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';

/**
 * Smoke test for the critical paths: signup → login → create event → join →
 * admin overview. Requires a running MySQL (DATABASE_URL) seeded via
 * `npm run seed` (uses the seeded admin you@jmaa.app / password123 and the
 * seeded activity catalog).
 */
describe('hudlgo API (e2e)', () => {
  let app: INestApplication;
  const rnd = Math.random().toString(36).slice(2, 8);
  const email = `e2e-${rnd}@jmaa.app`;
  let access = '';
  let eventId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health → ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /activity-types → public catalog', async () => {
    const res = await request(app.getHttpServer()).get('/activity-types').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /auth/signup → active immediately + tokens (18+)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'E2E User',
        email,
        password: 'password123',
        birthday: '1995-01-01',
        neighborhood: 'Maârif',
        zip: '20330',
        gender: 'MALE',
      })
      .expect(201);
    expect(res.body.user.status).toBe('ACTIVE');
    expect(res.body.accessToken).toBeDefined();
    access = res.body.accessToken;
  });

  it('rejects under-18 signup with 422', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Kid', email: `kid-${rnd}@jmaa.app`, password: 'password123', birthday: '2015-01-01', neighborhood: 'X', zip: '20330' })
      .expect(422);
  });

  it('GET /auth/me → current user', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${access}`).expect(200);
    expect(res.body.email).toBe(email);
  });

  it('POST /events → live immediately; rejects same-day/<4h via 422', async () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${access}`)
      .send({
        activityId: 'coffee',
        title: 'Too soon',
        locationLabel: 'Café',
        address: 'Public café, Maârif',
        lat: 33.58,
        lng: -7.63,
        isPublicPlace: true,
        startsAt: soon,
        endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        maxAttendees: 6,
      })
      .expect(422);

    const startsAt = new Date(Date.now() + 2 * 86_400_000);
    startsAt.setHours(18, 0, 0, 0);
    const res = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${access}`)
      .send({
        activityId: 'coffee',
        title: 'E2E coffee meetup',
        locationLabel: 'Café Bahia',
        address: 'Public café, Maârif',
        lat: 33.58,
        lng: -7.63,
        isPublicPlace: true,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 90 * 60000).toISOString(),
        maxAttendees: 6,
      })
      .expect(201);
    expect(res.body.lifecycle).toBe('live');
    eventId = res.body.id;
  });

  it('rejects private-home venues with 422', async () => {
    const startsAt = new Date(Date.now() + 2 * 86_400_000);
    startsAt.setHours(18, 0, 0, 0);
    await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${access}`)
      .send({
        activityId: 'coffee',
        title: 'Drinks at my apartment',
        locationLabel: 'My place',
        address: 'My apartment, 4th floor',
        lat: 33.58,
        lng: -7.63,
        isPublicPlace: true,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 90 * 60000).toISOString(),
        maxAttendees: 6,
      })
      .expect(422);
  });

  it('seeded user can join the event', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'lena@jmaa.app', password: 'password123' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/events/${eventId}/join`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(201);
    expect(res.body.message).toContain('Meeting at');
  });

  it('seeded admin can read the moderation overview; non-admin is 403', async () => {
    await request(app.getHttpServer()).get('/admin/overview').set('Authorization', `Bearer ${access}`).expect(403);

    const admin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'you@jmaa.app', password: 'password123' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('openReports');
    expect(res.body).toHaveProperty('flaggedUsers');
  });
});

/**
 * Business-side critical path (Foundation): create business → submit verification →
 * admin approve → claim a seeded LISTED venue → admin approve claim → venue CLAIMED.
 * Also asserts the BusinessRoleGuard (non-member → 403) and the §7 privacy boundary
 * (no business-facing attendee endpoint). Requires the seeded DB.
 */
describe('hudlgo business side (e2e)', () => {
  let app: INestApplication;
  const rnd = Math.random().toString(36).slice(2, 8);
  let ownerAccess = '';
  let outsiderAccess = '';
  let adminAccess = '';
  let businessId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
    await app.init();

    const owner = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Biz Owner', email: `owner-${rnd}@jmaa.app`, password: 'password123', birthday: '1990-01-01', neighborhood: 'Anfa', zip: '20050', gender: 'OTHER' })
      .expect(201);
    ownerAccess = owner.body.accessToken;

    const outsider = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Outsider', email: `out-${rnd}@jmaa.app`, password: 'password123', birthday: '1990-01-01', neighborhood: 'X', zip: '20050', gender: 'OTHER' })
      .expect(201);
    outsiderAccess = outsider.body.accessToken;

    const admin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'you@jmaa.app', password: 'password123' })
      .expect(201);
    adminAccess = admin.body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a business (PENDING_VERIFICATION) and adds the creator as OWNER', async () => {
    const res = await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${ownerAccess}`)
      .send({ name: `Smoke Padel ${rnd}`, category: 'sports_venue', address: 'Casablanca', contactEmail: `smoke-${rnd}@jmaa.app`, acceptBusinessTos: true })
      .expect(201);
    expect(res.body.status).toBe('pending_verification');
    expect(res.body.role).toBe('owner');
    businessId = res.body.id;

    const mine = await request(app.getHttpServer()).get('/me/businesses').set('Authorization', `Bearer ${ownerAccess}`).expect(200);
    expect(mine.body.some((b: { id: string }) => b.id === businessId)).toBe(true);
  });

  it('rejects business creation without ToS acceptance (400)', async () => {
    await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${ownerAccess}`)
      .send({ name: 'No ToS', category: 'cafe', address: 'X', contactEmail: `n-${rnd}@jmaa.app`, acceptBusinessTos: false })
      .expect(400);
  });

  it('BusinessRoleGuard: a non-member cannot PATCH the business (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/businesses/${businessId}`)
      .set('Authorization', `Bearer ${outsiderAccess}`)
      .send({ description: 'hijack' })
      .expect(403);
  });

  it('verification flow: submit → admin approve → business VERIFIED', async () => {
    await request(app.getHttpServer())
      .post(`/businesses/${businessId}/verification`)
      .set('Authorization', `Bearer ${ownerAccess}`)
      .field('rcNumber', 'RC-123')
      .field('iceNumber', 'ICE-456')
      .expect(201);

    const list = await request(app.getHttpServer()).get('/admin/business-verifications').set('Authorization', `Bearer ${adminAccess}`).expect(200);
    const item = list.body.find((v: { businessId: string }) => v.businessId === businessId);
    expect(item).toBeDefined();

    await request(app.getHttpServer())
      .post(`/admin/business-verifications/${item.id}/approve`)
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(201);

    const profile = await request(app.getHttpServer()).get(`/businesses/${businessId}`).expect(200);
    expect(profile.body.verified).toBe(true);
  });

  it('claim flow: claim a LISTED venue → admin approve → venue CLAIMED', async () => {
    const venues = await request(app.getHttpServer()).get('/venues').expect(200);
    const listed = venues.body.find((v: { status: string }) => v.status === 'listed');
    expect(listed).toBeDefined();

    await request(app.getHttpServer())
      .post(`/venues/${listed.id}/claim`)
      .set('Authorization', `Bearer ${ownerAccess}`)
      .field('businessId', businessId)
      .expect(201);

    const claims = await request(app.getHttpServer()).get('/admin/venue-claims').set('Authorization', `Bearer ${adminAccess}`).expect(200);
    const claim = claims.body.find((c: { venueId: string }) => c.venueId === listed.id);
    expect(claim).toBeDefined();

    await request(app.getHttpServer())
      .post(`/admin/venue-claims/${claim.id}/approve`)
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(201);

    const venue = await request(app.getHttpServer()).get(`/venues/${listed.id}`).expect(200);
    expect(['claimed', 'verified']).toContain(venue.body.status);
    expect(venue.body.business?.id).toBe(businessId);
  });

  it('§7 privacy: there is no business-facing attendee endpoint (404)', async () => {
    await request(app.getHttpServer())
      .get(`/businesses/${businessId}/attendees`)
      .set('Authorization', `Bearer ${ownerAccess}`)
      .expect(404);
  });
});
