import * as path from 'path';
import { config as loadEnv } from 'dotenv';

// pnpm --filter runs this with cwd = labs/01-caching, so bare `dotenv/config`
// would only ever see this package's local .env (just DATABASE_URL) and miss
// the shared config — CACHE_ENABLED, LAB01_PORT, etc. — that lives in the
// repo root .env. Load both explicitly, root taking precedence, so editing
// the root .env and restarting actually changes what the app sees.
loadEnv({ path: [path.resolve(__dirname, '../../../.env'), path.resolve(__dirname, '../.env')] });

import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config, createLogger } from '@shared/core';
import { AppModule } from './app.module';

const logger = createLogger('lab-01-caching');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(config.lab01.port);
  logger.info(`Lab 01 (caching) listening on port ${config.lab01.port}`);
}

bootstrap();
