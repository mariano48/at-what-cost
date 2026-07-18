import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics/metrics.service';

@Controller()
export class AppController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('metrics')
  getMetrics() {
    return this.metrics.snapshot();
  }
}
