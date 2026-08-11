import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import { PublicService } from './public.service'
import { IsEmail, IsEnum, IsIn, IsString, MinLength, MaxLength } from 'class-validator'
import { Throttle } from '@nestjs/throttler'

class ConfirmAppointmentDto {
  @IsIn(['CONFIRM', 'DECLINE'])
  action: 'CONFIRM' | 'DECLINE'
}

class SignupDto {
  @IsString()
  name: string
  @IsEmail()
  adminEmail: string
  @IsString()
  adminPassword: string
  @IsEnum(['BASIC', 'PRO'] as any)
  plan: 'BASIC' | 'PRO'
}

class PublicLoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  identifier: string
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string
}

@Controller('public')
export class SignupController {
  constructor(private readonly service: PublicService) {}

  @Get('ping')
  ping() {
    return { ok: true, service: 'odonto-backend', t: Date.now() }
  }

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.service.signup(dto)
  }
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: PublicLoginDto) {
    return this.service.loginByIdentifier(dto.identifier, dto.password)
  }

  /** Identidade visual da clínica (nome, cor, logo). Usada pelo app após o login para aplicar o tema da clínica. */
  @Get('branding')
  branding(@Headers('x-tenant') tenantHeader?: string, @Query('subdomain') subdomainQuery?: string) {
    return this.service.getBranding((tenantHeader || subdomainQuery || '').toString())
  }

  /** Tela pública de confirmação de consulta — o paciente acessa pelo link do e-mail, sem login. */
  @Get('appointments/confirm/:subdomain/:token')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  getConfirmation(@Param('subdomain') subdomain: string, @Param('token') token: string) {
    return this.service.getAppointmentConfirmation(subdomain, token)
  }

  @Post('appointments/confirm/:subdomain/:token')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  respondConfirmation(@Param('subdomain') subdomain: string, @Param('token') token: string, @Body() dto: ConfirmAppointmentDto) {
    return this.service.respondAppointmentConfirmation(subdomain, token, dto.action)
  }
}
