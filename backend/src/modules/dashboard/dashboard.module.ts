import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Module({
  controllers: [DashboardController],
  providers: [TenantPrismaService]
})
export class DashboardModule {}
