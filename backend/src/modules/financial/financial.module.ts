import { Module } from '@nestjs/common'
import { FinancialController } from './financial.controller'
import { FinancialService } from './financial.service'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Module({
  controllers: [FinancialController],
  providers: [FinancialService, TenantPrismaService]
})
export class FinancialModule {}
