import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Must run before the static middleware below: express.static ends the
  // response itself for any GET/HEAD it can serve, so it never reaches
  // Nest's own CORS middleware if that's registered after. Without CORS
  // headers on the *actual* response (not just an OPTIONS preflight),
  // Chrome's <video> element can't read Content-Range while buffering a
  // cross-origin file and just hangs at readyState 0 forever — <img> tags
  // don't hit this because a full-file image load doesn't need to
  // introspect response headers the way ranged video playback does.
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "https://thecosmopolitan.banelengubane.dev",
    ],
    credentials: true,
  });

 // Serve static files using Express directly
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();