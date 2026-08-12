import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import { S3Service } from './s3.service'
import { AuthGuard } from '@nestjs/passport'
import { IsString } from 'class-validator'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { Request, Response } from 'express'

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
  async finalize(@Req() req: Request, @Body() dto: { key: string; url: string; contentType: string; size?: number; patientId?: string }) {
    const prisma = this.prismaTenant.getClient()
    const requester = (req as any).user
    if (requester?.role === 'DENTIST') {
      if (!dto.patientId) throw new ForbiddenException('Selecione um paciente vinculado à sua agenda.')
      const appointment = await prisma.appointment.findFirst({
        where: { patientId: dto.patientId, dentistId: requester.userId },
        select: { id: true }
      })
      if (!appointment) throw new ForbiddenException('Você só pode anexar arquivos aos pacientes vinculados à sua agenda.')
    }
    const data: any = { key: dto.key, url: dto.url, contentType: dto.contentType, size: dto.size || 0 }
    if (dto.patientId) data.patientId = dto.patientId
    return prisma.file.create({ data })
  }

  @Get(':id/content')
  async content(@Req() req: Request, @Res() res: Response, @Param('id') id: string) {
    const prisma = this.prismaTenant.getClient()
    const file = await prisma.file.findUnique({ where: { id } })
    if (!file) throw new NotFoundException('Arquivo não encontrado')

    const requester = (req as any).user
    if (requester?.role === 'DENTIST') {
      const appointment = await prisma.appointment.findFirst({
        where: { patientId: file.patientId, dentistId: requester.userId },
        select: { id: true }
      })
      if (!appointment) throw new ForbiddenException('Você só pode acessar arquivos de pacientes vinculados à sua agenda.')
    }

    res.setHeader('Content-Type', file.contentType || 'application/octet-stream')
    res.setHeader('Content-Disposition', 'inline')
    const stream = await this.s3.getObject(file.key)
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end()
      else res.end()
    })
    stream.pipe(res)
  }
}
