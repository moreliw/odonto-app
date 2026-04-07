import { Module } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'
import { AppointmentsController } from './appointments.controller'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Module({
  providers: [AppointmentsService, TenantPrismaService],
  controllers: [AppointmentsController]
})
export class AppointmentsModule {}
