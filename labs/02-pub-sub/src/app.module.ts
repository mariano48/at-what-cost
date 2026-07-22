import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CheckoutModule } from './checkout/checkout.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, CheckoutModule],
  controllers: [AppController],
})
export class AppModule {}
