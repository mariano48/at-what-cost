import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { config, createLogger, PAYMENT_COMPLETED, PaymentCompletedEvent } from '@shared/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { NotificationsService } from './notifications/notifications.service';
import { PaymentService } from './payment/payment.service';

const logger = createLogger('checkout.service');

/**
 * Two architectures behind the same POST /checkout, toggled at boot by
 * ARCHITECTURE (like Lab 01's CACHE_ENABLED):
 *
 * - monolith: every side effect runs inline and sequentially. The steps are not
 *   atomic (a charge is real money, an email is a network call), so a failing
 *   email returns a 500 and skips the audit even though the order is already
 *   PAID and the card charged. Coupled by construction.
 * - events: charge + persist the order, then emit PaymentCompleted and return.
 *   Independent handlers (orders, notifications, audit) react in-process. A
 *   failing email now fails in isolation — the response is 200 and the audit
 *   still runs. That failure-isolation gap is the lab's number.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async checkout(dto: CreateCheckoutDto) {
    return config.lab02.architecture === 'events'
      ? this.checkoutViaEvents(dto)
      : this.checkoutInline(dto);
  }

  /** ARCHITECTURE=monolith — the coupled baseline (Phase 2a, unchanged). */
  private async checkoutInline(dto: CreateCheckoutDto) {
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

  /**
   * ARCHITECTURE=events — charge and persist synchronously (payment is core: the
   * caller must know if the card was declined), then hand off the side effects
   * to in-process subscribers via PaymentCompleted and return immediately. The
   * order is still PENDING in this response; OrdersHandler flips it to PAID a
   * beat later — the eventual-consistency cost this pattern trades for isolation.
   */
  private async checkoutViaEvents(dto: CreateCheckoutDto) {
    const order = await this.prisma.order.create({
      data: {
        reference: `ORD-${randomUUID().slice(0, 8)}`,
        customerEmail: dto.customerEmail,
        amount: dto.amount,
        status: 'PENDING',
      },
    });

    const payment = await this.payments.charge(order.id, order.amount);

    const event: PaymentCompletedEvent = {
      orderId: order.id,
      reference: order.reference,
      customerEmail: order.customerEmail,
      amount: order.amount,
      providerRef: payment.providerRef ?? '',
      occurredAt: new Date().toISOString(),
    };
    this.events.emit(PAYMENT_COMPLETED, event);

    logger.info('Checkout accepted; PaymentCompleted emitted', { orderId: order.id });
    return {
      orderId: order.id,
      reference: order.reference,
      status: order.status,
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
