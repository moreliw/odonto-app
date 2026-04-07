import { Module } from '@nestjs/common'
import { RecordsController } from './records.controller'
import { RecordsService } from './records.service'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Module({
  controllers: [RecordsController],
  providers: [RecordsService, TenantPrismaService]
})
export class RecordsModule {}
