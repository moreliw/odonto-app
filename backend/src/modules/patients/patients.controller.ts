import { Body, Controller, Get, Param, Post, Put, Delete, Req, UseGuards } from '@nestjs/common'
import { PatientsService } from './patients.service'
import { AuthGuard } from '@nestjs/passport'
import { IsOptional, IsString, IsEmail, IsDateString } from 'class-validator'
import { Request } from 'express'

class PatientDto {
  @IsString()
  name: string
  @IsOptional()
  @IsEmail()
  email?: string
  @IsOptional()
  @IsString()
  phone?: string
  @IsOptional()
  @IsDateString()
  birthDate?: string
  @IsOptional()
  @IsString()
  document?: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}
  @Get()
  list() {
    return this.patients.list()
  }
  @Get(':id')
  get(@Param('id') id: string) {
    return this.patients.get(id)
  }
  @Post()
  create(@Req() req: Request, @Body() dto: PatientDto) {
    const data: any = { name: dto.name }
    if (dto.email) data.email = dto.email
    if (dto.phone) data.phone = dto.phone
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate)
    if (dto.document) data.document = dto.document
    return this.patients.create(data, (req as any).user?.email)
  }
  @Put(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: PatientDto) {
    const data: any = {}
    if (dto.name) data.name = dto.name
    if (dto.email) data.email = dto.email
    if (dto.phone) data.phone = dto.phone
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate)
    if (dto.document) data.document = dto.document
    return this.patients.update(id, data, (req as any).user?.email)
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.patients.remove(id)
  }
}
