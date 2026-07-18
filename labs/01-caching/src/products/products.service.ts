import { Injectable, NotFoundException } from '@nestjs/common';
import { config, createLogger } from '@shared/core';
import { Prisma } from '@prisma/client';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProductDto } from './dto/update-product.dto';

const logger = createLogger('products.service');

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * No caching yet (Phase 1a) — every read hits Postgres directly. An artificial
 * delay simulates a real network/disk-bound read so the cost is visible even
 * before Lab 01's cache-aside layer lands in Phase 1b.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
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

  async findOne(id: number) {
    await delay(config.lab01.dbLatencyMs);
    this.metrics.incrementDbQueryCount();

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    this.metrics.incrementDbQueryCount();

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: dto,
      });
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
