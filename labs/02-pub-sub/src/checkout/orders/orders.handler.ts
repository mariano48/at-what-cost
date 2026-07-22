import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createLogger, PAYMENT_COMPLETED, PaymentCompletedEvent } from '@shared/core';
import { PrismaService } from '../../prisma/prisma.service';

const logger = createLogger('orders.handler');

/**
 * Reacts to PaymentCompleted by marking the order PAID (ARCHITECTURE=events).
 * In the monolith this update is inline in CheckoutService; here it is an
 * independent subscriber. A failure is logged and swallowed so it never bubbles
 * back to the HTTP response — the whole point of the events split.
 */
@Injectable()
export class OrdersHandler {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(PAYMENT_COMPLETED)
  async onPaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    try {
      await this.prisma.order.update({
        where: { id: event.orderId },
        data: { status: 'PAID' },
      });
      logger.info('Order marked PAID', { orderId: event.orderId });
    } catch (error) {
      logger.error('Failed to update order', {
        orderId: event.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
