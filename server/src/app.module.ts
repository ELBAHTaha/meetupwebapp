import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { TrustModule } from './trust/trust.module';
import { StorageModule } from './storage/storage.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ActivityTypesModule } from './activity-types/activity-types.module';
import { EventsModule } from './events/events.module';
import { ChatModule } from './chat/chat.module';
import { RatingsModule } from './ratings/ratings.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { MonetizationModule } from './monetization/monetization.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { ttl: config.get<number>('throttle.ttl', 60000), limit: config.get<number>('throttle.limit', 120) },
      ],
    }),
    ScheduleModule.forRoot(),
    // Infrastructure
    PrismaModule,
    TrustModule,
    StorageModule,
    GeocodingModule,
    NotificationsModule,
    // Features
    AuthModule,
    UsersModule,
    ActivityTypesModule,
    EventsModule,
    ChatModule,
    RatingsModule,
    ReportsModule,
    AdminModule,
    MonetizationModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
