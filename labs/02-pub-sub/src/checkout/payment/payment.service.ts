import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { config, createLogger } from '@shared/core';
import { PrismaService } from '../../prisma/prisma.service';

const logger = createLogger('payment.service');

/**
 * Fake payment provider. There is no real gateway — SIMULATE_CHARGE_FAILURE
 * lets the lab reproduce a declined charge deterministically.
 */
@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async charge(orderId: number, amount: number) {
    if (config.lab02.simulateChargeFailure) {
      await this.prisma.payment.create({
        data: { orderId, amount, status: 'FAILED' },
      });
      logger.warn('Charge failed (simulated)', { orderId, amount });
      throw new Error('Payment charge failed (simulated)');
    }

    const payment = await this.prisma.payment.create({
      data: { orderId, amount, status: 'CHARGED', providerRef: `pay_${randomUUID().slice(0, 12)}` },
    });
    logger.info('Charge succeeded', { orderId, amount, providerRef: payment.providerRef });
    return payment;
  }
}
