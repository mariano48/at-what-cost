import { Controller, Get } from '@nestjs/common';
import { config } from '@shared/core';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', architecture: config.lab02.architecture };
  }
}
