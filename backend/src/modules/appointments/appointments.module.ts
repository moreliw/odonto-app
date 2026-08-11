import { Module } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'
import { AppointmentsController } from './appointments.controller'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { MailerModule } from '../mailer/mailer.module'
import { WhatsappModule } from '../whatsapp/whatsapp.module'

@Module({
  imports: [MailerModule, WhatsappModule],
  providers: [AppointmentsService, TenantPrismaService],
  controllers: [AppointmentsController]
})
export class AppointmentsModule {}
