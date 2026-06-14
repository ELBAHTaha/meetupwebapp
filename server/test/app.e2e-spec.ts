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
describe('Jmaâ API (e2e)', () => {
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
