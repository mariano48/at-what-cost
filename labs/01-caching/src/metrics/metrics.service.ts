import { Injectable } from '@nestjs/common';

/**
 * Minimal in-memory counters for the benchmark script to read via GET /metrics.
 * Resets on process restart — this lab isn't trying to be a real metrics stack.
 */
@Injectable()
export class MetricsService {
  private dbQueryCount = 0;
  private cacheHitCount = 0;
  private cacheMissCount = 0;

  incrementDbQueryCount(): void {
    this.dbQueryCount += 1;
  }

  incrementCacheHitCount(): void {
    this.cacheHitCount += 1;
  }

  incrementCacheMissCount(): void {
    this.cacheMissCount += 1;
  }

  snapshot() {
    const cacheLookups = this.cacheHitCount + this.cacheMissCount;
    return {
      dbQueryCount: this.dbQueryCount,
      cacheHitCount: this.cacheHitCount,
      cacheMissCount: this.cacheMissCount,
      cacheHitRate: cacheLookups > 0 ? this.cacheHitCount / cacheLookups : 0,
    };
  }
}
