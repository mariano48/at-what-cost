import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createLogger, PAYMENT_COMPLETED, PaymentCompletedEvent } from '@shared/core';
import { AuditService } from './audit.service';

const logger = createLogger('audit.handler');

/**
 * Reacts to PaymentCompleted by writing the audit trail (ARCHITECTURE=events).
 * In the monolith this runs last and is skipped when the email step throws
 * first; as an independent subscriber it runs regardless of whether the email
 * handler failed — that is the isolation the events split buys.
 */
@Injectable()
export class AuditHandler {
  constructor(private readonly audit: AuditService) {}

  @OnEvent(PAYMENT_COMPLETED)
  async onPaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    try {
      await this.audit.record('checkout.completed', event.orderId, `charged ${event.amount}`);
      logger.info('Audit recorded', { orderId: event.orderId });
    } catch (error) {
      logger.error('Failed to write audit log', {
        orderId: event.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
