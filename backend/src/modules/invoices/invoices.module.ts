import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices.controller'
import { InvoicesService } from './invoices.service'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, TenantPrismaService]
})
export class InvoicesModule {}
