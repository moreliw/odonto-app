import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { AuthGuard } from '@nestjs/passport'
import { IsEmail, IsString, IsEnum, IsOptional, Matches, MinLength } from 'class-validator'
import { Request } from 'express'
enum RoleLocal { ADMIN='ADMIN', USER='USER', DENTIST='DENTIST' }

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
  @MinLength(8)
  password: string
  @IsEnum(RoleLocal)
  role: RoleLocal
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string
  @IsOptional()
  @IsEmail()
  email?: string
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  private assertAdmin(req: Request) {
    if ((req as any).user?.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas o administrador da clínica pode gerenciar a equipe.')
    }
  }

  @Get()
  list(@Req() req: Request, @Query('role') role?: RoleLocal) {
    this.assertAdmin(req)
    return this.users.list(role)
  }

  /** Quantos dentistas o plano permite e quantos já foram cadastrados. */
  @Get('dentist-quota')
  dentistQuota(@Req() req: Request) {
    this.assertAdmin(req)
    return this.users.dentistQuota()
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const user = (req as any).user
    return this.users.create(user, dto)
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = (req as any).user
    return this.users.update(user, id, dto)
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user
    return this.users.remove(user, id)
  }
}
