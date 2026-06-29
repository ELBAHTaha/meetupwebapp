import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false, rawBody: true });
  const config = app.get(ConfigService);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // FRONTEND_URL may be a single origin or a comma-separated allow-list, e.g.
  // "https://hudlgo.com,https://www.hudlgo.com". Whitespace is tolerated. When an
  // array is passed, the cors middleware reflects the request Origin if it matches.
  const allowedOrigins = (config.get<string>('frontendUrl') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global JWT guard (routes opt out via @Public / @OptionalAuth).
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));

  // Serve uploaded files.
  app.useStaticAssets(join(process.cwd(), config.get<string>('uploadsDir', 'uploads')), {
    prefix: '/uploads/',
  });

  // Swagger / OpenAPI
  const swagger = new DocumentBuilder()
    .setTitle('hudlgo API')
    .setDescription('Backend for the hudlgo Morocco activity/meetup app.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('port', 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`hudlgo API on http://localhost:${port}  ·  docs at /docs`);
}

void bootstrap();
