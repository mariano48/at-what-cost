import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { config, createLogger } from '@shared/core';
import type Keyv from 'keyv';

const logger = createLogger('cache');

/**
 * CACHE_ENABLED=false skips the Redis store entirely — cache-manager falls
 * back to its default in-memory store, which ProductsService never touches
 * in that mode. This keeps "what if the cache layer is off" from depending
 * on Redis being reachable at all, per the README's "one more moving part"
 * cost callout.
 */
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const stores: Keyv[] = [];

        if (config.cache.enabled) {
          // createKeyv() already returns a fully-formed Keyv instance wired
          // to the Redis adapter — do not wrap it in another `new Keyv()`,
          // that double-wrapping breaks Keyv's internal store introspection.
          const keyv = createKeyv(config.redisUrl);
          keyv.on('error', (error) => {
            logger.error('Redis cache error', { error: String(error) });
          });
          stores.push(keyv);
        }

        return { stores, ttl: config.cache.ttlSeconds * 1000 };
      },
    }),
  ],
})
export class LabCacheModule {}
