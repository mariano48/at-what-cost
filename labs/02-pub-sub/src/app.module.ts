import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { CheckoutModule } from './checkout/checkout.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  // In-process event bus for ARCHITECTURE=events. Handlers live in one process
  // (modular monolith) — this is DI wiring, not a message broker. Durability
  // across process restarts is Lab 03's boundary, deliberately not built here.
  imports: [EventEmitterModule.forRoot(), PrismaModule, CheckoutModule],
  controllers: [AppController],
})
export class AppModule {}
