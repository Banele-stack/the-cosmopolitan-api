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

 // Serve static files using Express directly.
  //
  // This must be resolved from process.cwd(), not __dirname: every upload
  // destination (multer's diskStorage in room.controller.ts and
  // business.controller.ts) is the relative path './uploads', which Node
  // resolves against the process's working directory — the project root
  // Nest is launched from. __dirname instead points at wherever *this
  // compiled file* lives (dist/src, since tsc mirrors src/ under dist/ with
  // no rootDir override), so join(__dirname, '..', 'uploads') resolved to
  // dist/uploads — a directory that's never created and never matches
  // where files are actually written. The practical effect: every
  // freshly-uploaded photo 404'd and silently never rendered, while
  // pre-seeded listings (whose images are external URLs, not /uploads
  // paths) looked completely fine — masking the bug in any test that only
  // exercises seeded data.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(
    '/uploads',
    express.static(join(process.cwd(), 'uploads'), {
      // Uploaded filenames are unique per-upload (see the diskStorage
      // filename functions), so a given URL's bytes never change — safe to
      // let the phone cache it for a year instead of re-fetching the same
      // photo on every visit.
      maxAge: '365d',
      immutable: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();