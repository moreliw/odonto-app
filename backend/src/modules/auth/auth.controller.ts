import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { IsString, MinLength, MaxLength } from 'class-validator'

class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  identifier: string
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string
}

class RefreshDto {
  @IsString()
  token: string
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.identifier, dto.password)
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.token)
  }
}
