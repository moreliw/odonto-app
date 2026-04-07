import { Module } from '@nestjs/common'
import { PublicService } from './public.service'
import { SignupController } from './signup.controller'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [SignupController],
  providers: [PublicService, TenantProvisionService, MasterPrismaService]
})
export class PublicModule {}
