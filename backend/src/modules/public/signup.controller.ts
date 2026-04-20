import { Body, Controller, Get, Post } from '@nestjs/common'
import { PublicService } from './public.service'
import { IsEmail, IsEnum, IsString, MinLength, MaxLength } from 'class-validator'

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
  login(@Body() dto: PublicLoginDto) {
    return this.service.loginByIdentifier(dto.identifier, dto.password)
  }
}
