import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common'
import { PublicService } from './public.service'
import { IsEmail, IsEnum, IsString, MinLength, MaxLength } from 'class-validator'
import { Throttle } from '@nestjs/throttler'

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
}
