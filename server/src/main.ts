import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

function parseCorsOrigins(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configuredOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  const isProd = process.env.NODE_ENV === 'production';

  const corsOrigin =
    configuredOrigins.length > 0
      ? configuredOrigins
      : isProd
        ? ['https://quickik.ru', 'https://www.quickik.ru']
        : true;

  // Keep dev flexible, but lock prod to the project domains (or CORS_ORIGINS).
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 3001;
  // Bind to 0.0.0.0 so the API is reachable from other devices on the LAN,
  // not only from localhost on the host machine.
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`QIK Anime API running on http://0.0.0.0:${port}/api (LAN-accessible)`);
}
bootstrap();
