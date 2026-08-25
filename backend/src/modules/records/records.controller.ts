import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { RecordsService } from './records.service'
import { AuthGuard } from '@nestjs/passport'
import { IsDefined, IsString } from 'class-validator'
import { Request } from 'express'
import { PermissionGuard } from '../access-control/permission.guard'
import { RequirePermission } from '../access-control/require-permission.decorator'

class RecordDto {
  @IsString()
  patientId: string

  @IsDefined()
  content: unknown
}

@UseGuards(AuthGuard('jwt'), PermissionGuard)
@RequirePermission('RECORDS_VIEW')
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}
  @Post()
  @RequirePermission('RECORDS_MANAGE')
  create(@Req() req: Request, @Body() dto: RecordDto) {
    return this.records.create((req as any).user, dto.patientId, dto.content)
  }
  @Get('patient/:patientId')
  list(@Req() req: Request, @Param('patientId') patientId: string) {
    return this.records.list((req as any).user, patientId)
  }
}
