import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { config, createLogger } from '@shared/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { NotificationsService } from './notifications/notifications.service';
import { PaymentService } from './payment/payment.service';

const logger = createLogger('checkout.service');

/**
 * Phase 2a — the coupled baseline (ARCHITECTURE=monolith).
 *
 * One request drives every side effect sequentially: create order → charge →
 * mark paid → email receipt → audit. The steps are not atomic: a payment is
 * real money, an email is a network call. So when the email step throws
 * (SIMULATE_EMAIL_FAILURE=true), the caller gets a 500 and the audit step
 * never runs — even though the order is already PAID and the card was charged.
 * That partial-completion pain is the motivation for the events split in 2b.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async checkout(dto: CreateCheckoutDto) {
    if (config.lab02.architecture === 'events') {
      // Events mode lands in Phase 2b (in-process domain events + handlers).
      throw new NotImplementedException(
        'ARCHITECTURE=events is not implemented yet — use ARCHITECTURE=monolith (Phase 2a).',
      );
    }

    const order = await this.prisma.order.create({
      data: {
        reference: `ORD-${randomUUID().slice(0, 8)}`,
        customerEmail: dto.customerEmail,
        amount: dto.amount,
        status: 'PENDING',
      },
    });

    await this.payments.charge(order.id, order.amount);

    const paidOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    });

    // Inline and coupled: a throw here aborts the request before audit runs.
    await this.notifications.sendReceipt(paidOrder.customerEmail, order.id, order.amount);

    await this.audit.record('checkout.completed', order.id, `charged ${order.amount}`);

    logger.info('Checkout completed', { orderId: order.id });
    return {
      orderId: order.id,
      reference: paidOrder.reference,
      status: paidOrder.status,
    };
  }

  async getOrder(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { orderId: id },
      orderBy: { id: 'asc' },
    });

    return { ...order, auditLogs };
  }
}
