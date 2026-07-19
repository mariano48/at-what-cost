import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { config, createLogger } from '@shared/core';
import { Prisma, Product } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProductDto } from './dto/update-product.dto';

const logger = createLogger('products.service');

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function cacheKey(id: number): string {
  return `product:${id}`;
}

/**
 * Cache-aside sits only in front of `findOne` — that's the hot single-key
 * read the lab's README describes, and `findAll`'s paginated result set
 * would need its own invalidation strategy that's out of scope here (see
 * "Keep labs intentionally focused" in docs/documentation-philosophy.md).
 *
 * CACHE_ENABLED=false bypasses the cache entirely rather than pointing it at
 * an empty store, so the "cache off" baseline and the "Redis is down"
 * scenario behave the same way: every read falls through to Postgres.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll(page: number, pageSize: number) {
    await delay(config.lab01.dbLatencyMs);
    this.metrics.incrementDbQueryCount();

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        orderBy: { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count(),
    ]);

    return { items, page, pageSize, total };
  }

  async findOne(id: number): Promise<Product> {
    if (config.cache.enabled) {
      const cached = await this.cache.get<Product>(cacheKey(id));
      if (cached) {
        this.metrics.incrementCacheHitCount();
        return cached;
      }
      this.metrics.incrementCacheMissCount();
    }

    await delay(config.lab01.dbLatencyMs);
    this.metrics.incrementDbQueryCount();

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    if (config.cache.enabled) {
      await this.cache.set(cacheKey(id), product, config.cache.ttlSeconds * 1000);
    }

    return product;
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    this.metrics.incrementDbQueryCount();

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: dto,
      });

      if (config.cache.enabled) {
        // Invalidate rather than repopulate — a wrong cache entry from a lost
        // race between two concurrent writes is worse than a cache miss.
        await this.cache.del(cacheKey(id));
      }

      logger.info('Product updated', { id });
      return product;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Product ${id} not found`);
      }
      throw error;
    }
  }
}
