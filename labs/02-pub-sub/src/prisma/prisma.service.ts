import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '@shared/core';
import { PrismaClient } from '../generated/prisma';

/**
 * The adapter's `schema` option pins runtime queries to the `lab02` Postgres
 * schema, matching the `?schema=lab02` the Prisma CLI uses for migrations.
 * This keeps Lab 02's tables isolated from Lab 01 on the same database.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: config.databaseUrl }, { schema: 'lab02' }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
