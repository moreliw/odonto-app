import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import { S3Service } from './s3.service'
import { AuthGuard } from '@nestjs/passport'
import { IsString } from 'class-validator'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { Request, Response } from 'express'
import { PermissionGuard } from '../access-control/permission.guard'
import { RequirePermission } from '../access-control/require-permission.decorator'

class PresignDto {
  @IsString()
  contentType: string
}

@UseGuards(AuthGuard('jwt'), PermissionGuard)
@RequirePermission('RECORDS_VIEW')
@Controller('files')
export class FilesController {
  constructor(private readonly s3: S3Service, private readonly prismaTenant: TenantPrismaService) {}
  @Post('presign')
  @RequirePermission('RECORDS_MANAGE')
  presign(@Body() dto: PresignDto) {
    return this.s3.presignPut(dto.contentType)
  }
  @Post('finalize')
  @RequirePermission('RECORDS_MANAGE')
  async finalize(@Req() req: Request, @Body() dto: { key: string; url: string; contentType: string; size?: number; patientId?: string; originalName?: string; category?: string; notes?: string }) {
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
    const actor = await prisma.user.findUnique({ where: { id: requester.userId }, select: { name: true } })
    const data: any = {
      key: dto.key,
      url: dto.url,
      contentType: dto.contentType,
      size: dto.size || 0,
      originalName: dto.originalName?.trim() || null,
      category: dto.category?.trim() || null,
      notes: dto.notes?.trim() || null,
      uploadedByName: actor?.name?.trim() || requester.name?.trim() || 'Sistema'
    }
    if (dto.patientId) data.patientId = dto.patientId
    return prisma.file.create({ data })
  }

  @Delete(':id')
  @RequirePermission('RECORDS_MANAGE')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const prisma = this.prismaTenant.getClient()
    const requester = (req as any).user
    const file = await prisma.file.findUnique({ where: { id } })
    if (!file) throw new NotFoundException('Arquivo não encontrado')
    if (requester?.role === 'DENTIST') {
      const appointment = await prisma.appointment.findFirst({
        where: { patientId: file.patientId, dentistId: requester.userId },
        select: { id: true }
      })
      if (!appointment) throw new ForbiddenException('Você só pode excluir arquivos de pacientes vinculados à sua agenda.')
    }
    await this.s3.removeObject(file.key)
    await prisma.file.delete({ where: { id } })
    return { ok: true }
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
