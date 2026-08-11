import { Module } from '@nestjs/common'
import { PublicService } from './public.service'
import { SignupController } from './signup.controller'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { AuthModule } from '../auth/auth.module'
import { FilesModule } from '../files/files.module'

@Module({
  imports: [AuthModule, FilesModule],
  controllers: [SignupController],
  providers: [PublicService, TenantProvisionService, MasterPrismaService]
})
export class PublicModule {}
