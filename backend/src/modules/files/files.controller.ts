import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { S3Service } from './s3.service'
import { AuthGuard } from '@nestjs/passport'
import { IsOptional, IsString } from 'class-validator'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

class PresignDto {
  @IsString()
  contentType: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('files')
export class FilesController {
  constructor(private readonly s3: S3Service, private readonly prismaTenant: TenantPrismaService) {}
  @Post('presign')
  presign(@Body() dto: PresignDto) {
    return this.s3.presignPut(dto.contentType)
  }
  @Post('finalize')
  async finalize(@Body() dto: { key: string; url: string; contentType: string; size?: number; patientId?: string }) {
    const prisma = this.prismaTenant.getClient()
    const data: any = { key: dto.key, url: dto.url, contentType: dto.contentType, size: dto.size || 0 }
    if (dto.patientId) data.patientId = dto.patientId
    return prisma.file.create({ data })
  }
}
