import { Module } from '@nestjs/common'
import { PatientsService } from './patients.service'
import { PatientsController } from './patients.controller'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Module({
  providers: [PatientsService, TenantPrismaService],
  controllers: [PatientsController]
})
export class PatientsModule {}
