import { Module, Global } from '@nestjs/common'
import { MasterPrismaService } from './master-prisma.service'
import { TenantService } from './tenant.service'
import { TenantPrismaService } from './tenant-prisma.service'
import { TenantProvisionService } from './tenant-provision.service'
import { TenantsController } from './tenants.controller'

@Global()
@Module({
  providers: [MasterPrismaService, TenantService, TenantPrismaService, TenantProvisionService],
  controllers: [TenantsController],
  exports: [MasterPrismaService, TenantService, TenantPrismaService, TenantProvisionService]
})
export class TenancyModule {}
