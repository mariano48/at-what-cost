import { NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ProductsService } from './products.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MetricsService } from '../metrics/metrics.service';

// Unit-level: mock @shared/core rather than pulling in the real config/logger,
// so this test exercises ProductsService's cache-aside logic in isolation —
// no real Redis or Postgres, no dependency on .env / process.env state.
jest.mock('@shared/core', () => ({
  config: {
    lab01: { dbLatencyMs: 0 },
    cache: { enabled: true, ttlSeconds: 60 },
  },
  createLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

const product = {
  id: 1,
  sku: 'SKU-1',
  name: 'Widget',
  price: 10,
  updatedAt: new Date('2026-01-01'),
};

function buildService() {
  const prisma = {
    product: {
      findUnique: jest.fn().mockResolvedValue(product),
      update: jest.fn().mockResolvedValue({ ...product, price: 19.99 }),
    },
  } as unknown as PrismaService;

  const metrics = {
    incrementDbQueryCount: jest.fn(),
    incrementCacheHitCount: jest.fn(),
    incrementCacheMissCount: jest.fn(),
  } as unknown as MetricsService;

  // In-memory stand-in for the Redis-backed CACHE_MANAGER provider — same
  // get/set/del contract, just backed by a Map instead of Keyv/Redis.
  const store = new Map<string, unknown>();
  const cache: Cache = {
    get: jest.fn((key: string) => Promise.resolve(store.get(key))),
    set: jest.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve(undefined);
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(undefined);
    }),
  } as unknown as Cache;

  return { service: new ProductsService(prisma, metrics, cache), prisma, cache };
}

describe('ProductsService', () => {
  it('serves the second read for the same id from cache, not Postgres', async () => {
    const { service, prisma } = buildService();

    await service.findOne(1);
    await service.findOne(1);

    expect(prisma.product.findUnique).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cached entry on update, so the next read misses cache and hits Postgres again', async () => {
    const { service, prisma, cache } = buildService();

    await service.findOne(1); // populates the cache
    await service.update(1, { price: 19.99 });

    expect(cache.del).toHaveBeenCalledWith('product:1');

    await service.findOne(1); // must be a cache miss post-invalidation
    expect(prisma.product.findUnique).toHaveBeenCalledTimes(2);
  });

  it('throws NotFoundException for an id that does not exist, without caching a miss', async () => {
    const { service, prisma, cache } = buildService();
    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
    expect(cache.set).not.toHaveBeenCalled();
  });
});
