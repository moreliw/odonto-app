import { Body, Controller, Get, Param, Post, Put, Delete, Query, Req, UseGuards } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'
import { AuthGuard } from '@nestjs/passport'
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator'
import { Request } from 'express'

enum AppointmentStatusLocal {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

class AppointmentDto {
  @IsString()
  patientId: string
  @IsOptional()
  @IsString()
  dentistId?: string
  @IsDateString()
  startTime: string
  @IsDateString()
  endTime: string
  @IsEnum(AppointmentStatusLocal)
  status: AppointmentStatusLocal
  @IsOptional()
  @IsString()
  notes?: string
}

class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  patientId?: string
  @IsOptional()
  @IsString()
  dentistId?: string | null
  @IsOptional()
  @IsDateString()
  startTime?: string
  @IsOptional()
  @IsDateString()
  endTime?: string
  @IsOptional()
  @IsEnum(AppointmentStatusLocal)
  status?: AppointmentStatusLocal
  @IsOptional()
  @IsString()
  notes?: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(@Req() req: Request, @Query('dentistId') dentistId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const user = (req as any).user
    return this.appointments.list({ requester: user, dentistId, from, to })
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.appointments.get(id)
  }

  @Post()
  create(@Req() req: Request, @Body() dto: AppointmentDto) {
    const user = (req as any).user
    return this.appointments.create(user, {
      patientId: dto.patientId,
      dentistId: dto.dentistId,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      status: dto.status,
      notes: dto.notes
    })
  }

  @Put(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    const user = (req as any).user
    const data: Record<string, unknown> = {}
    if (dto.patientId !== undefined) data.patientId = dto.patientId
    if (dto.dentistId !== undefined) data.dentistId = dto.dentistId || null
    if (dto.startTime !== undefined) data.startTime = new Date(dto.startTime)
    if (dto.endTime !== undefined) data.endTime = new Date(dto.endTime)
    if (dto.status !== undefined) data.status = dto.status
    if (dto.notes !== undefined) data.notes = dto.notes
    return this.appointments.update(user, id, data)
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user
    return this.appointments.remove(user, id)
  }
}
