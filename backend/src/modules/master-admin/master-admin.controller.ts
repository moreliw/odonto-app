import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { MasterAdminService } from './master-admin.service'
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator'
import { Plan, SubscriptionStatus } from '@prisma/client-master'
import { MasterAdminGuard } from './master-admin.guard'

class MasterLoginDto {
  @IsEmail()
  email: string
  @IsString()
  @MinLength(8)
  password: string
}

class CreateClinicDto {
  @IsString()
  name: string
  @IsOptional()
  @IsString()
  subdomain?: string
  @IsEmail()
  adminEmail: string
  @IsString()
  @MinLength(8)
  adminPassword: string
  @IsEnum(['BASIC', 'PRO'] as any)
  plan: Plan
  @IsInt()
  @Min(1000)
  priceCents: number
}

class UpdateClinicDto {
  @IsOptional()
  @IsString()
  name?: string
  @IsOptional()
  @IsString()
  subdomain?: string
  @IsOptional()
  @IsString()
  internalNotes?: string | null
  @IsOptional()
  @IsEnum(['BASIC', 'PRO'] as any)
  plan?: Plan
  @IsOptional()
  @IsEnum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'] as any)
  status?: SubscriptionStatus
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number
  @IsOptional()
  @IsString()
  currency?: string
  @IsOptional()
  @IsString()
  renewsAt?: string | null
  @IsOptional()
  @IsString()
  canceledAt?: string | null
}

class ResetTenantAdminPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string
  @IsOptional()
  @IsEmail()
  adminEmail?: string
}

@Controller('master')
export class MasterAdminController {
  constructor(private readonly service: MasterAdminService) {}

  @Post('auth/login')
  login(@Body() dto: MasterLoginDto) {
    return this.service.login(dto.email, dto.password)
  }

  @UseGuards(MasterAdminGuard)
  @Get('operations/overview')
  operationsOverview() {
    return this.service.operationsOverview()
  }

  @UseGuards(MasterAdminGuard)
  @Get('finance/clinics')
  financeClinics() {
    return this.service.financeClinics()
  }

  @UseGuards(MasterAdminGuard)
  @Get('clinics')
  clinics() {
    return this.service.listClinics()
  }

  @UseGuards(MasterAdminGuard)
  @Get('clinics/:id')
  clinicDetail(@Param('id') id: string) {
    return this.service.getClinic(id)
  }

  @UseGuards(MasterAdminGuard)
  @Get('clinics/:id/operations')
  clinicOperations(@Param('id') id: string) {
    return this.service.clinicOperations(id)
  }

  @UseGuards(MasterAdminGuard)
  @Post('clinics')
  createClinic(@Body() dto: CreateClinicDto) {
    return this.service.createClinic(dto)
  }

  @UseGuards(MasterAdminGuard)
  @Patch('clinics/:id')
  updateClinic(@Param('id') id: string, @Body() dto: UpdateClinicDto) {
    return this.service.updateClinic(id, dto)
  }

  @UseGuards(MasterAdminGuard)
  @Post('clinics/:id/admin/reset-password')
  resetTenantAdminPassword(@Param('id') id: string, @Body() dto: ResetTenantAdminPasswordDto) {
    return this.service.resetTenantAdminPassword(id, dto.newPassword, dto.adminEmail)
  }

  @UseGuards(MasterAdminGuard)
  @Get('finance/summary')
  financeSummary() {
    return this.service.financeSummary()
  }
}
