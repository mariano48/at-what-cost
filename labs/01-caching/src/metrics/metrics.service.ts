import { Injectable } from '@nestjs/common';

/**
 * Minimal in-memory counter for the benchmark script to read via GET /metrics.
 * Resets on process restart — this lab isn't trying to be a real metrics stack.
 * Phase 1b (cache-aside) will extend this with cache hit/miss counters.
 */
@Injectable()
export class MetricsService {
  private dbQueryCount = 0;

  incrementDbQueryCount(): void {
    this.dbQueryCount += 1;
  }

  snapshot() {
    return {
      dbQueryCount: this.dbQueryCount,
    };
  }
}
