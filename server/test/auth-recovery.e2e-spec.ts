import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthTokensService } from '../src/auth/auth-tokens.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, futureSlot, rnd, signupUser } from './helpers';

/**
 * Phase 1 — password reset + email verification. Requires a migrated MySQL
 * (DATABASE_URL) with the activity catalog seeded (`npm run seed`).
 */
describe('auth recovery & email verification (e2e)', () => {
  let app: INestApplication;
  let tokens: AuthTokensService;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    tokens = app.get(AuthTokensService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('email verification', () => {
    let user: Awaited<ReturnType<typeof signupUser>>;

    beforeAll(async () => {
      user = await signupUser(app, { verified: false });
    });

    it('new email signups start unverified (and get a verification token)', async () => {
      const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${user.access}`).expect(200);
      expect(me.body.emailVerified).toBe(false);
      // Signup fires the verification email asynchronously — give it a tick.
      await new Promise((r) => setTimeout(r, 300));
      const issued = await prisma.authToken.count({ where: { userId: user.id, type: 'EMAIL_VERIFY' } });
      expect(issued).toBeGreaterThanOrEqual(1);
    });

    it('unverified users can browse but cannot create activities (403 EMAIL_NOT_VERIFIED)', async () => {
      await request(app.getHttpServer()).get('/events').set('Authorization', `Bearer ${user.access}`).expect(200);
      const res = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${user.access}`)
        .send({
          activityId: 'coffee',
          title: 'Unverified coffee',
          locationLabel: 'Café',
          address: 'Public café, Maârif',
          lat: 33.58,
          lng: -7.63,
          isPublicPlace: true,
          ...futureSlot(),
          maxAttendees: 6,
        })
        .expect(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('unverified users cannot join activities either', async () => {
      const feed = await request(app.getHttpServer()).get('/events?limit=1').expect(200);
      if (!feed.body.items.length) return; // empty DB — nothing to join
      const res = await request(app.getHttpServer())
        .post(`/events/${feed.body.items[0].id}/join`)
        .set('Authorization', `Bearer ${user.access}`)
        .expect(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('resend-verification works for unverified users', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${user.access}`)
        .expect(200);
      expect(res.body).toEqual({ success: true, alreadyVerified: false });
    });

    it('verify-email consumes the token once; the account becomes verified', async () => {
      const raw = await tokens.issue(user.id, 'EMAIL_VERIFY', 60_000);
      await request(app.getHttpServer()).post('/auth/verify-email').send({ token: raw }).expect(200);
      const reuse = await request(app.getHttpServer()).post('/auth/verify-email').send({ token: raw }).expect(400);
      expect(reuse.body.code).toBe('INVALID_TOKEN');

      const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${user.access}`).expect(200);
      expect(me.body.emailVerified).toBe(true);

      const again = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${user.access}`)
        .expect(200);
      expect(again.body.alreadyVerified).toBe(true);
    });

    it('rejects expired and garbage verification tokens', async () => {
      const expired = await tokens.issue(user.id, 'EMAIL_VERIFY', -1000);
      await request(app.getHttpServer()).post('/auth/verify-email').send({ token: expired }).expect(400);
      await request(app.getHttpServer()).post('/auth/verify-email').send({ token: 'nope' }).expect(400);
    });
  });

  describe('password reset', () => {
    let user: Awaited<ReturnType<typeof signupUser>>;

    beforeAll(async () => {
      user = await signupUser(app);
    });

    it('forgot-password answers identically for known and unknown emails', async () => {
      const known = await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: user.email }).expect(200);
      const unknown = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: `nobody-${rnd()}@hudlgo.test` })
        .expect(200);
      expect(known.body).toEqual(unknown.body);
      const issued = await prisma.authToken.count({ where: { userId: user.id, type: 'PASSWORD_RESET' } });
      expect(issued).toBe(1);
    });

    it('a newer reset token invalidates older ones', async () => {
      const older = await tokens.issue(user.id, 'PASSWORD_RESET', 3_600_000);
      await tokens.issue(user.id, 'PASSWORD_RESET', 3_600_000);
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: older, newPassword: 'brand-new-pass' })
        .expect(400);
    });

    it('enforces the signup password rules', async () => {
      const raw = await tokens.issue(user.id, 'PASSWORD_RESET', 3_600_000);
      await request(app.getHttpServer()).post('/auth/reset-password').send({ token: raw, newPassword: 'short' }).expect(400);
    });

    it('resets the password, is single-use, and revokes every refresh token', async () => {
      const raw = await tokens.issue(user.id, 'PASSWORD_RESET', 3_600_000);
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: raw, newPassword: 'brand-new-pass' })
        .expect(200);

      // Single use.
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: raw, newPassword: 'another-pass-1' })
        .expect(400);

      // Old sessions are gone.
      await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: user.refresh }).expect(401);

      // Old password no longer works; the new one does.
      await request(app.getHttpServer()).post('/auth/login').send({ email: user.email, password: 'password123' }).expect(401);
      await request(app.getHttpServer()).post('/auth/login').send({ email: user.email, password: 'brand-new-pass' }).expect(201);
    });

    it('lets a Google-only account (no password) set one through the same flow', async () => {
      const email = `google-${rnd()}@hudlgo.test`;
      const g = await prisma.user.create({
        data: { email, name: 'Google Person', googleId: `g-${rnd()}`, emailVerifiedAt: new Date() },
      });
      const raw = await tokens.issue(g.id, 'PASSWORD_RESET', 3_600_000);
      await request(app.getHttpServer()).post('/auth/reset-password').send({ token: raw, newPassword: 'now-i-have-one' }).expect(200);
      await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'now-i-have-one' }).expect(201);
    });

    it('stores only a hash of the token', async () => {
      const raw = await tokens.issue(user.id, 'PASSWORD_RESET', 3_600_000);
      const plain = await prisma.authToken.findFirst({ where: { tokenHash: raw } });
      expect(plain).toBeNull();
    });
  });
});
