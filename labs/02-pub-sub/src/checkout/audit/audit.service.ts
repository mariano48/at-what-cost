import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: string, orderId: number, detail: string): Promise<void> {
    await this.prisma.auditLog.create({ data: { event, orderId, detail } });
  }
}
