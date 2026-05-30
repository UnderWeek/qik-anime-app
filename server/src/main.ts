import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the Vite frontend (and any origin in dev) to call the API
  app.enableCors({
    origin: true,
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
