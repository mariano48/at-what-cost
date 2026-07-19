import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LabCacheModule } from './cache/cache.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [PrismaModule, MetricsModule, LabCacheModule, ProductsModule],
  controllers: [AppController],
})
export class AppModule {}
