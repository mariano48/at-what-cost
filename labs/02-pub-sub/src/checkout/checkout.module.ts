import { Module } from '@nestjs/common';
import { AuditHandler } from './audit/audit.handler';
import { AuditService } from './audit/audit.service';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { NotificationsHandler } from './notifications/notifications.handler';
import { NotificationsService } from './notifications/notifications.service';
import { OrdersController } from './orders.controller';
import { OrdersHandler } from './orders/orders.handler';
import { PaymentService } from './payment/payment.service';

@Module({
  controllers: [CheckoutController, OrdersController],
  // Services hold the side-effect logic (shared by both modes). Handlers wire
  // that logic to the PaymentCompleted event and only fire in ARCHITECTURE=events;
  // in monolith mode nothing is emitted, so they stay dormant.
  providers: [
    CheckoutService,
    PaymentService,
    NotificationsService,
    AuditService,
    OrdersHandler,
    NotificationsHandler,
    AuditHandler,
  ],
})
export class CheckoutModule {}
