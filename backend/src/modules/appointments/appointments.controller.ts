import { Body, Controller, Get, Param, Post, Put, Delete, UseGuards } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'
import { AuthGuard } from '@nestjs/passport'
import { IsString, IsDateString, IsEnum } from 'class-validator'

enum AppointmentStatusLocal {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

class AppointmentDto {
  @IsString()
  patientId: string
  @IsDateString()
  startTime: string
  @IsDateString()
  endTime: string
  @IsEnum(AppointmentStatusLocal)
  status: AppointmentStatusLocal
}

@UseGuards(AuthGuard('jwt'))
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}
  @Get()
  list() {
    return this.appointments.list()
  }
  @Get(':id')
  get(@Param('id') id: string) {
    return this.appointments.get(id)
  }
  @Post()
  create(@Body() dto: AppointmentDto) {
    const data = { patientId: dto.patientId, startTime: new Date(dto.startTime), endTime: new Date(dto.endTime), status: dto.status }
    return this.appointments.create(data)
  }
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: AppointmentDto) {
    const data: any = {}
    if (dto.patientId) data.patientId = dto.patientId
    if (dto.startTime) data.startTime = new Date(dto.startTime)
    if (dto.endTime) data.endTime = new Date(dto.endTime)
    if (dto.status) data.status = dto.status
    return this.appointments.update(id, data)
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointments.remove(id)
  }
}
