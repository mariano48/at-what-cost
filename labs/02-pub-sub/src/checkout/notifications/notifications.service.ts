import { Injectable } from '@nestjs/common';
import { config, createLogger } from '@shared/core';

const logger = createLogger('notifications.service');

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * Fake receipt email. The simulated latency is what makes this side effect a
 * plausible failure point; SIMULATE_EMAIL_FAILURE makes it throw on demand —
 * the failure this lab uses to show monolith coupling vs event isolation.
 */
@Injectable()
export class NotificationsService {
  async sendReceipt(customerEmail: string, orderId: number, amount: number): Promise<void> {
    await delay(100);

    if (config.lab02.simulateEmailFailure) {
      logger.warn('Receipt email failed (simulated)', { orderId, customerEmail });
      throw new Error('Email send failed (simulated)');
    }

    logger.info('Receipt email sent', { orderId, customerEmail, amount });
  }
}
