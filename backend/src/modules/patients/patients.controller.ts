import { Body, Controller, Get, Param, Post, Put, Delete, UseGuards } from '@nestjs/common'
import { PatientsService } from './patients.service'
import { AuthGuard } from '@nestjs/passport'
import { IsOptional, IsString, IsEmail, IsDateString } from 'class-validator'

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
  create(@Body() dto: PatientDto) {
    const data: any = { name: dto.name }
    if (dto.email) data.email = dto.email
    if (dto.phone) data.phone = dto.phone
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate)
    if (dto.document) data.document = dto.document
    return this.patients.create(data)
  }
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: PatientDto) {
    const data: any = {}
    if (dto.name) data.name = dto.name
    if (dto.email) data.email = dto.email
    if (dto.phone) data.phone = dto.phone
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate)
    if (dto.document) data.document = dto.document
    return this.patients.update(id, data)
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.patients.remove(id)
  }
}
