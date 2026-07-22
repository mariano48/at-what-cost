import { Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { NotificationsService } from './notifications/notifications.service';
import { OrdersController } from './orders.controller';
import { PaymentService } from './payment/payment.service';

@Module({
  controllers: [CheckoutController, OrdersController],
  providers: [CheckoutService, PaymentService, NotificationsService, AuditService],
})
export class CheckoutModule {}
