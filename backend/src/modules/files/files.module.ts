import { Module } from '@nestjs/common'
import { FilesController } from './files.controller'
import { S3Service } from './s3.service'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Module({
  controllers: [FilesController],
  providers: [S3Service, TenantPrismaService]
})
export class FilesModule {}
