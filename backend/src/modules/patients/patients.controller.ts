import { Body, Controller, Get, Param, Post, Put, Delete, Req, UseGuards } from '@nestjs/common'
import { PatientsService } from './patients.service'
import { AuthGuard } from '@nestjs/passport'
import { IsOptional, IsString, IsEmail, IsDateString } from 'class-validator'
import { Request } from 'express'
import { PermissionGuard } from '../access-control/permission.guard'
import { RequirePermission } from '../access-control/require-permission.decorator'

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

  @IsOptional() @IsString() whatsapp?: string
  @IsOptional() @IsString() gender?: string
  @IsOptional() @IsString() photoUrl?: string
  @IsOptional() @IsString() postalCode?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() addressNumber?: string
  @IsOptional() @IsString() addressComplement?: string
  @IsOptional() @IsString() neighborhood?: string
  @IsOptional() @IsString() city?: string
  @IsOptional() @IsString() state?: string
  @IsOptional() @IsString() profession?: string
  @IsOptional() @IsString() guardianName?: string
  @IsOptional() @IsString() insuranceName?: string
  @IsOptional() @IsString() insuranceNumber?: string
  @IsOptional() @IsString() notes?: string
  @IsOptional() @IsString() bloodType?: string
  @IsOptional() @IsString() allergies?: string
  @IsOptional() @IsString() medications?: string
  @IsOptional() @IsString() preexistingConditions?: string
  @IsOptional() @IsString() medicalNotes?: string
}

const OPTIONAL_PATIENT_FIELDS = [
  'email', 'phone', 'whatsapp', 'document', 'gender', 'photoUrl', 'postalCode', 'address',
  'addressNumber', 'addressComplement', 'neighborhood', 'city', 'state', 'profession',
  'guardianName', 'insuranceName', 'insuranceNumber', 'notes', 'bloodType', 'allergies',
  'medications', 'preexistingConditions', 'medicalNotes'
] as const

function patientData(dto: PatientDto, partial = false) {
  const data: Record<string, unknown> = {}
  if (!partial || dto.name !== undefined) data.name = dto.name?.trim()
  for (const field of OPTIONAL_PATIENT_FIELDS) {
    if (dto[field] !== undefined) data[field] = dto[field]?.trim() || null
  }
  if (dto.birthDate !== undefined) data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null
  return data
}

@UseGuards(AuthGuard('jwt'), PermissionGuard)
@RequirePermission('PATIENTS_VIEW')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}
  @Get()
  list(@Req() req: Request) {
    return this.patients.list((req as any).user)
  }
  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.patients.get((req as any).user, id)
  }
  @Get(':id/workspace')
  workspace(@Req() req: Request, @Param('id') id: string) {
    return this.patients.workspace((req as any).user, id)
  }
  @Post()
  @RequirePermission('PATIENTS_MANAGE')
  create(@Req() req: Request, @Body() dto: PatientDto) {
    return this.patients.create((req as any).user, patientData(dto))
  }
  @Put(':id')
  @RequirePermission('PATIENTS_MANAGE')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: PatientDto) {
    return this.patients.update((req as any).user, id, patientData(dto, true))
  }
  @Delete(':id')
  @RequirePermission('PATIENTS_MANAGE')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.patients.remove((req as any).user, id)
  }
}
