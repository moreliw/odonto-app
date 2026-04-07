import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { RecordsService } from './records.service'
import { AuthGuard } from '@nestjs/passport'
import { IsString } from 'class-validator'

class RecordDto {
  @IsString()
  patientId: string
  content: any
}

@UseGuards(AuthGuard('jwt'))
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}
  @Post()
  create(@Body() dto: RecordDto) {
    return this.records.create(dto.patientId, dto.content)
  }
  @Get('patient/:patientId')
  list(@Param('patientId') patientId: string) {
    return this.records.list(patientId)
  }
}
