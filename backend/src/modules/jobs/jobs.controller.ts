import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request } from 'express'
import { JobsService } from './jobs.service'
import { IsEmail, IsString } from 'class-validator'

class EmailDto {
  @IsEmail()
  to: string
  @IsString()
  subject: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}
  @Post('email')
  enqueue(@Req() req: Request, @Body() dto: EmailDto) {
    if ((req as any).user?.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas o administrador da clínica pode enviar comunicações.')
    }
    return this.jobs.enqueueEmail(dto.to, dto.subject)
  }
}
