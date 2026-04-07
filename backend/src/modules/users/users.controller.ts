import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { AuthGuard } from '@nestjs/passport'
import { IsEmail, IsString, IsEnum, IsOptional, Matches } from 'class-validator'
import { Request } from 'express'
enum RoleLocal { ADMIN='ADMIN', USER='USER' }

class CreateUserDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/)
  username?: string
  @IsEmail()
  email: string
  @IsString()
  name: string
  @IsString()
  password: string
  @IsEnum(RoleLocal)
  role: RoleLocal
}

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get()
  list() {
    return this.users.list()
  }
  @Post()
  create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const user = (req as any).user
    return this.users.create(user, dto)
  }
}
