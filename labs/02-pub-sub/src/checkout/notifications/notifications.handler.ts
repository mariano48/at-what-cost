import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createLogger, PAYMENT_COMPLETED, PaymentCompletedEvent } from '@shared/core';
import { NotificationsService } from './notifications.service';

const logger = createLogger('notifications.handler');

/**
 * Reacts to PaymentCompleted by sending the receipt email (ARCHITECTURE=events).
 * Delegates to the same NotificationsService the monolith calls inline — the
 * only difference is where the failure lands. Here the throw is caught and
 * logged, so SIMULATE_EMAIL_FAILURE fails this side effect in isolation without
 * failing the checkout or blocking the other handlers.
 */
@Injectable()
export class NotificationsHandler {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(PAYMENT_COMPLETED)
  async onPaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    try {
      await this.notifications.sendReceipt(event.customerEmail, event.orderId, event.amount);
    } catch (error) {
      logger.error('Receipt email failed — isolated, checkout already returned', {
        orderId: event.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
