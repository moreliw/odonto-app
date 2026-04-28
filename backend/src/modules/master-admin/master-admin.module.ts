import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { MasterAdminController } from './master-admin.controller'
import { MasterAdminService } from './master-admin.service'
import { MasterAdminGuard } from './master-admin.guard'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { BillingModule } from '../billing/billing.module'

@Module({
  imports: [
    BillingModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret'
    })
  ],
  controllers: [MasterAdminController],
  providers: [MasterAdminService, MasterAdminGuard, MasterPrismaService, TenantProvisionService]
})
export class MasterAdminModule {}
