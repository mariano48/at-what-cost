import { AuditHandler } from './audit/audit.handler';
import { NotificationsHandler } from './notifications/notifications.handler';
import { OrdersHandler } from './orders/orders.handler';
import type { AuditService } from './audit/audit.service';
import type { NotificationsService } from './notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PaymentCompletedEvent } from '@shared/core';

// Unit-level: mock @shared/core so the handlers run without real config/env or
// console noise. PAYMENT_COMPLETED is only used by the @OnEvent decorator here;
// the tests invoke the handler methods directly, the way the event bus fans a
// single PaymentCompleted out to every subscriber.
jest.mock('@shared/core', () => ({
  createLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
  PAYMENT_COMPLETED: 'payment.completed',
}));

const event: PaymentCompletedEvent = {
  orderId: 1,
  reference: 'ORD-abc12345',
  customerEmail: 'demo@example.com',
  amount: 42,
  providerRef: 'pay_test',
  occurredAt: '2026-07-21T00:00:00.000Z',
};

function buildHandlers() {
  const prisma = {
    order: { update: jest.fn().mockResolvedValue({ id: 1, status: 'PAID' }) },
  } as unknown as PrismaService;

  const notifications = {
    sendReceipt: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  return {
    orders: new OrdersHandler(prisma),
    notifications: new NotificationsHandler(notifications),
    audit: new AuditHandler(audit),
    prisma,
    notificationsService: notifications,
    auditService: audit,
  };
}

describe('PaymentCompleted handlers', () => {
  describe('OrdersHandler', () => {
    it('marks the order PAID', async () => {
      const { orders, prisma } = buildHandlers();

      await orders.onPaymentCompleted(event);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: event.orderId },
        data: { status: 'PAID' },
      });
    });

    it('swallows a DB failure instead of letting it bubble', async () => {
      const { orders, prisma } = buildHandlers();
      (prisma.order.update as jest.Mock).mockRejectedValueOnce(new Error('db down'));

      await expect(orders.onPaymentCompleted(event)).resolves.toBeUndefined();
    });
  });

  describe('NotificationsHandler', () => {
    it('forwards the event to the receipt-email service', async () => {
      const { notifications, notificationsService } = buildHandlers();

      await notifications.onPaymentCompleted(event);

      expect(notificationsService.sendReceipt).toHaveBeenCalledWith(
        event.customerEmail,
        event.orderId,
        event.amount,
      );
    });

    it('swallows a failed email instead of letting it bubble (the isolation contract)', async () => {
      const { notifications, notificationsService } = buildHandlers();
      (notificationsService.sendReceipt as jest.Mock).mockRejectedValueOnce(
        new Error('Email send failed (simulated)'),
      );

      await expect(notifications.onPaymentCompleted(event)).resolves.toBeUndefined();
    });
  });

  describe('AuditHandler', () => {
    it('writes the audit trail', async () => {
      const { audit, auditService } = buildHandlers();

      await audit.onPaymentCompleted(event);

      expect(auditService.record).toHaveBeenCalledWith(
        'checkout.completed',
        event.orderId,
        `charged ${event.amount}`,
      );
    });

    it('swallows a write failure instead of letting it bubble', async () => {
      const { audit, auditService } = buildHandlers();
      (auditService.record as jest.Mock).mockRejectedValueOnce(new Error('audit table gone'));

      await expect(audit.onPaymentCompleted(event)).resolves.toBeUndefined();
    });
  });

  // The lab's core claim, in a test: one PaymentCompleted fans out to all three
  // subscribers, and a failing email handler must not take the others down with
  // it (unlike the monolith, where the email throw aborts the whole checkout).
  it('isolates a failing email: orders + audit still run, nothing rejects', async () => {
    const { orders, notifications, audit, prisma, notificationsService, auditService } =
      buildHandlers();
    (notificationsService.sendReceipt as jest.Mock).mockRejectedValueOnce(
      new Error('Email send failed (simulated)'),
    );

    await expect(
      Promise.all([
        orders.onPaymentCompleted(event),
        notifications.onPaymentCompleted(event),
        audit.onPaymentCompleted(event),
      ]),
    ).resolves.toBeDefined();

    expect(prisma.order.update).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledTimes(1);
  });
});
