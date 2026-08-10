import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { MasterAdminService } from './master-admin.service'
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator'
import { Type } from 'class-transformer'
import { Plan, SubscriptionStatus } from '@prisma/client-master'
import { MasterAdminGuard } from './master-admin.guard'
import { Throttle } from '@nestjs/throttler'

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
  @IsEnum(Plan)
  plan: Plan
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  /** Mensalidade em reais (ex.: 129.0). Armazenada como centavos no banco. */
  priceMonthlyBrl: number
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
  @IsString()
  @Matches(/^(#[0-9a-fA-F]{6})?$/)
  /** Cor primária da marca (hex). Enviar string vazia remove a personalização e volta ao azul padrão. */
  primaryColor?: string
  @IsOptional()
  @IsString()
  /** URL pública do logo. Enviar string vazia remove o logo personalizado. */
  logoUrl?: string
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  /** Alternativa a priceCents: valor mensal em reais */
  priceMonthlyBrl?: number
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

class SetClinicActiveDto {
  @IsBoolean()
  active: boolean
}

class DeleteClinicDto {
  @IsString()
  @MinLength(1)
  confirmName: string
}

class ResetTenantAdminPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string
  @IsOptional()
  @IsEmail()
  adminEmail?: string
}

enum TenantRoleDto { ADMIN = 'ADMIN', USER = 'USER', DENTIST = 'DENTIST' }

class CreateTenantUserDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/)
  username?: string
  @IsEmail()
  email: string
  @IsString()
  name: string
  @IsString()
  @MinLength(8)
  password: string
  @IsEnum(TenantRoleDto)
  role: TenantRoleDto
  @IsOptional()
  @IsBoolean()
  active?: boolean
}

class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/)
  username?: string
  @IsOptional()
  @IsEmail()
  email?: string
  @IsOptional()
  @IsString()
  name?: string
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string
  @IsOptional()
  @IsEnum(TenantRoleDto)
  role?: TenantRoleDto
  @IsOptional()
  @IsBoolean()
  active?: boolean
}

class SupportSessionDto {
  @IsOptional()
  @IsString()
  userId?: string
}

class AccessGrantDto {
  @IsEnum(Plan)
  plan: Plan
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dentistLimit?: number | null
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string
  @IsOptional()
  @IsString()
  expiresAt?: string | null
  @IsOptional()
  @IsBoolean()
  stopBilling?: boolean
}

@Controller('master')
export class MasterAdminController {
  constructor(private readonly service: MasterAdminService) {}

  @Post('auth/login')
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
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
    const priceCents = Math.round(dto.priceMonthlyBrl * 100)
    const { priceMonthlyBrl: _p, ...rest } = dto
    return this.service.createClinic({ ...rest, priceCents })
  }

  @UseGuards(MasterAdminGuard)
  @Patch('clinics/:id')
  updateClinic(@Param('id') id: string, @Body() dto: UpdateClinicDto) {
    const { priceMonthlyBrl, ...rest } = dto
    const priceCents =
      typeof priceMonthlyBrl === 'number' ? Math.round(priceMonthlyBrl * 100) : undefined
    return this.service.updateClinic(id, {
      ...rest,
      ...(typeof priceCents === 'number' ? { priceCents } : {})
    })
  }

  @UseGuards(MasterAdminGuard)
  @Patch('clinics/:id/active')
  setClinicActive(@Param('id') id: string, @Body() dto: SetClinicActiveDto) {
    return this.service.setClinicActive(id, dto.active)
  }

  @UseGuards(MasterAdminGuard)
  @Delete('clinics/:id')
  deleteClinic(@Param('id') id: string, @Body() dto: DeleteClinicDto) {
    return this.service.deleteClinic(id, dto.confirmName)
  }

  @UseGuards(MasterAdminGuard)
  @Post('clinics/:id/admin/reset-password')
  resetTenantAdminPassword(@Param('id') id: string, @Body() dto: ResetTenantAdminPasswordDto) {
    return this.service.resetTenantAdminPassword(id, dto.newPassword, dto.adminEmail)
  }

  @UseGuards(MasterAdminGuard)
  @Get('clinics/:id/users')
  tenantUsers(@Param('id') id: string) {
    return this.service.listTenantUsers(id)
  }

  @UseGuards(MasterAdminGuard)
  @Post('clinics/:id/users')
  createTenantUser(@Param('id') id: string, @Body() dto: CreateTenantUserDto) {
    return this.service.createTenantUser(id, dto)
  }

  @UseGuards(MasterAdminGuard)
  @Patch('clinics/:id/users/:userId')
  updateTenantUser(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: UpdateTenantUserDto) {
    return this.service.updateTenantUser(id, userId, dto)
  }

  @UseGuards(MasterAdminGuard)
  @Post('clinics/:id/support-session')
  supportSession(@Param('id') id: string, @Body() dto: SupportSessionDto) {
    return this.service.createSupportSession(id, dto.userId)
  }

  @UseGuards(MasterAdminGuard)
  @Post('clinics/:id/access-grant')
  grantAccess(@Param('id') id: string, @Body() dto: AccessGrantDto) {
    return this.service.grantAccess(id, dto)
  }

  @UseGuards(MasterAdminGuard)
  @Post('clinics/:id/access-grant/revoke')
  revokeAccess(@Param('id') id: string) {
    return this.service.revokeAccess(id)
  }

  @UseGuards(MasterAdminGuard)
  @Get('finance/summary')
  financeSummary() {
    return this.service.financeSummary()
  }

  @UseGuards(MasterAdminGuard)
  @Get('payments/events')
  paymentEvents(@Query('tenantId') tenantId?: string) {
    return this.service.paymentEvents(tenantId)
  }

  @UseGuards(MasterAdminGuard)
  @Get('audit')
  auditLogs(@Query('tenantId') tenantId?: string, @Query('action') action?: string, @Query('take') take?: string) {
    return this.service.auditLogs({ tenantId, action, take: take ? Number(take) : undefined })
  }
}
