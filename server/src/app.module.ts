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
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ActivityTypesModule } from './activity-types/activity-types.module';
import { EventsModule } from './events/events.module';
import { ChatModule } from './chat/chat.module';
import { RatingsModule } from './ratings/ratings.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { FeedbackModule } from './feedback/feedback.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { MonetizationModule } from './monetization/monetization.module';
import { BusinessModule } from './business/business.module';
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
    MailModule,
    // Features
    AuthModule,
    UsersModule,
    ActivityTypesModule,
    EventsModule,
    ChatModule,
    RatingsModule,
    ReportsModule,
    AdminModule,
    FeedbackModule,
    MonetizationModule,
    // After MonetizationModule so its static /businesses/* routes register
    // before BusinessModule's GET /businesses/:id (Express matches in order).
    BusinessModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
