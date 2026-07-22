import * as path from 'path';
import { config as loadEnv } from 'dotenv';

// pnpm --filter runs this with cwd = labs/02-pub-sub, so load both the root .env
// (shared config — ARCHITECTURE, SIMULATE_* toggles, ports) and this package's
// local .env. Root is listed first and dotenv does not override already-set
// keys, so the root .env wins — editing it and restarting changes behavior.
loadEnv({ path: [path.resolve(__dirname, '../../../.env'), path.resolve(__dirname, '../.env')] });

import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config, createLogger } from '@shared/core';
import { AppModule } from './app.module';

const logger = createLogger('lab-02-pub-sub');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(config.lab02.port);
  logger.info(`Lab 02 (pub/sub) listening on port ${config.lab02.port}`, {
    architecture: config.lab02.architecture,
  });
}

bootstrap();
