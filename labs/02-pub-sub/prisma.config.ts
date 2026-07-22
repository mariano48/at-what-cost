import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Local .env sets DATABASE_URL with ?schema=lab02 so this lab's tables and
    // migration history live in their own Postgres schema, isolated from Lab 01
    // (public). Runtime uses the same isolation via the adapter's schema option.
    url: env('DATABASE_URL'),
  },
});
