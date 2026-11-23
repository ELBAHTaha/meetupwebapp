import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

/** Boot the full app the same way main.ts does (pipes, filter, global JWT guard). */
export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
  await app.init();
  return app;
}

/** Mark an account's email verified directly (tests that aren't about verification). */
export async function markVerified(app: INestApplication, email: string): Promise<void> {
  await app.get(PrismaService).user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
}

export const rnd = (): string => Math.random().toString(36).slice(2, 8);

/** Sign up a consumer (optionally pre-verified) and return its tokens + id. */
export async function signupUser(
  app: INestApplication,
  opts: { email?: string; name?: string; verified?: boolean } = {},
): Promise<{ email: string; id: string; access: string; refresh: string }> {
  const email = opts.email ?? `e2e-${rnd()}@hudlgo.test`;
  const res = await request(app.getHttpServer())
    .post('/auth/signup')
    .send({
      name: opts.name ?? 'E2E User',
      email,
      password: 'password123',
      birthday: '1995-01-01',
      neighborhood: 'Maârif',
      zip: '20330',
      gender: 'OTHER',
    })
    .expect(201);
  if (opts.verified !== false) await markVerified(app, email);
  return { email, id: res.body.user.id, access: res.body.accessToken, refresh: res.body.refreshToken };
}

/** A start time >4h out and not same-day (passes the create-event rules). */
export function futureSlot(daysAhead = 2, durationMins = 90): { startsAt: string; endsAt: string } {
  const startsAt = new Date(Date.now() + daysAhead * 86_400_000);
  startsAt.setHours(18, 0, 0, 0);
  return { startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + durationMins * 60000).toISOString() };
}
