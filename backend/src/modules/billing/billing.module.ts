import { Module } from '@nestjs/common'
import { BillingService } from './billing.service'
import { BillingController } from './billing.controller'
import { TenantBillingController } from './tenant-billing.controller'
import { MailerModule } from '../mailer/mailer.module'
import { AuthModule } from '../auth/auth.module'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Module({
  imports: [MailerModule, AuthModule],
  providers: [BillingService, TenantPrismaService],
  controllers: [BillingController, TenantBillingController],
  exports: [BillingService]
})
export class BillingModule {}
