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
