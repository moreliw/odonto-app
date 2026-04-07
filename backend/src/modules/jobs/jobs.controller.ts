import { Controller, Post, Body } from '@nestjs/common'
import { JobsService } from './jobs.service'
import { IsEmail, IsString } from 'class-validator'

class EmailDto {
  @IsEmail()
  to: string
  @IsString()
  subject: string
}

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}
  @Post('email')
  enqueue(@Body() dto: EmailDto) {
    return this.jobs.enqueueEmail(dto.to, dto.subject)
  }
}
