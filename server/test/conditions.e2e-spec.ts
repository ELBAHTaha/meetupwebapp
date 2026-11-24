import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, futureSlot, rnd, signupUser } from './helpers';

/**
 * Phase 3 — Open-Meteo conditions endpoint (upstream stubbed, no network) and
 * venue-backed "saved places".
 */
describe('conditions & spots (e2e)', () => {
  let app: INestApplication;
  const realFetch = global.fetch;
  let calls: string[] = [];

  const hourly = (h: Record<string, unknown[]>) =>
    new Response(JSON.stringify({ hourly: { time: ['x'], ...h } }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('marine-api')) return hourly({ wave_height: [1.64], wave_period: [9.2], sea_surface_temperature: [18.4] });
      if (url.includes('api.open-meteo.com')) return hourly({ temperature_2m: [21.26], wind_speed_10m: [12.3], weather_code: [2] });
      return realFetch(input);
    }) as typeof fetch;
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await app?.close();
  });

  const at = () => new Date(Date.now() + 2 * 86_400_000).toISOString();

  it('validates the query', async () => {
    await request(app.getHttpServer()).get('/conditions?lat=200&lng=0&at=2026-01-01T00:00:00Z').expect(400);
    await request(app.getHttpServer()).get('/conditions?lat=33&lng=-7').expect(400);
  });

  it('returns weather + sea state for water sports, and caches per cell/hour', async () => {
    const when = at();
    const lat = 33.59 + Math.random() / 1000; // same ~1km cell as below
    const res = await request(app.getHttpServer())
      .get(`/conditions?lat=${lat}&lng=-7.68&at=${encodeURIComponent(when)}&activity=surfing`)
      .expect(200);
    expect(res.body.fields).toMatchObject({ tempC: 21.3, windKts: 12.3, swellM: 1.6, wavePeriodS: 9.2, waterTempC: 18.4, summaryKey: 'cloudy' });
    expect(res.body.source).toBe('open-meteo');
    expect(calls).toHaveLength(2);

    calls = [];
    await request(app.getHttpServer())
      .get(`/conditions?lat=${lat}&lng=-7.68&at=${encodeURIComponent(when)}&activity=surfing`)
      .expect(200);
    expect(calls).toHaveLength(0); // served from cache
  });

  it('skips the marine API for land activities', async () => {
    const res = await request(app.getHttpServer())
      .get(`/conditions?lat=31.63&lng=-7.99&at=${encodeURIComponent(at())}&activity=hiking`)
      .expect(200);
    expect(res.body.fields.swellM).toBeUndefined();
    expect(calls.every((u) => !u.includes('marine-api'))).toBe(true);
  });

  it('returns null (widget hides) when the date is outside the forecast window or upstream fails', async () => {
    const far = new Date(Date.now() + 40 * 86_400_000).toISOString();
    const res = await request(app.getHttpServer()).get(`/conditions?lat=34.02&lng=-6.84&at=${encodeURIComponent(far)}`).expect(200);
    expect(res.body).toEqual({});
    expect(calls).toHaveLength(0);

    global.fetch = jest.fn(async () => new Response('boom', { status: 503 })) as typeof fetch;
    const down = await request(app.getHttpServer()).get(`/conditions?lat=35.76&lng=-5.83&at=${encodeURIComponent(at())}`).expect(200);
    expect(down.body).toEqual({});
  });

  it('creating an activity at a saved place links it to the venue', async () => {
    global.fetch = realFetch;
    const host = await signupUser(app);
    const venue = await app.get(PrismaService).venue.create({
      data: { name: `Spot ${rnd()}`, slug: `spot-${rnd()}`, address: 'Corniche, Casablanca', lat: 33.59, lng: -7.67, status: 'VERIFIED' },
    });
    const res = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${host.access}`)
      .send({
        activityId: 'coffee',
        title: 'Coffee at the spot',
        locationLabel: venue.name,
        address: venue.address,
        lat: venue.lat,
        lng: venue.lng,
        isPublicPlace: true,
        venueId: venue.id,
        ...futureSlot(),
        maxAttendees: 6,
      })
      .expect(201);
    const saved = await app.get(PrismaService).event.findUnique({ where: { id: res.body.id } });
    expect(saved?.venueId).toBe(venue.id);
  });
});
