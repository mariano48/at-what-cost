import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

/**
 * Read side for the smoke test — lets you see the partial-completion state
 * after a failed checkout (order PAID, payment CHARGED, but no audit row).
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.checkout.getOrder(id);
  }
}
