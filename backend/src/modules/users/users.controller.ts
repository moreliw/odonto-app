import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { AuthGuard } from '@nestjs/passport'
import { IsEmail, IsString, IsEnum, IsOptional, Matches, MinLength } from 'class-validator'
import { Request } from 'express'
import { PermissionGuard } from '../access-control/permission.guard'
import { RequirePermission } from '../access-control/require-permission.decorator'
enum RoleLocal { ADMIN='ADMIN', USER='USER', DENTIST='DENTIST' }

class CreateUserDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/)
  username?: string
  /** Opcional só para DENTIST — cadastro de referência, sem acesso ao sistema. */
  @IsOptional()
  @IsEmail()
  email?: string
  @IsString()
  name: string
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string
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

@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('TEAM_VIEW')
  list(@Query('role') role?: RoleLocal) {
    return this.users.list(role)
  }

  /** Dados do próprio usuário autenticado, para a página de perfil. */
  @Get('me')
  me(@Req() req: Request) {
    const user = (req as any).user
    return this.users.findById(user.userId)
  }

  /** Quantos dentistas o plano permite e quantos já foram cadastrados. */
  @Get('dentist-quota')
  @RequirePermission('TEAM_VIEW')
  dentistQuota() {
    return this.users.dentistQuota()
  }

  @Post()
  @RequirePermission('TEAM_MANAGE')
  create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const user = (req as any).user
    return this.users.create(user, dto)
  }

  /** Alterar os próprios dados não depende do acesso ao módulo Equipe. */
  @Patch('me')
  updateMe(@Req() req: Request, @Body() dto: UpdateUserDto) {
    const user = (req as any).user
    return this.users.update(user, user.userId, dto)
  }

  @Patch(':id')
  @RequirePermission('TEAM_MANAGE')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = (req as any).user
    return this.users.update(user, id, dto)
  }

  @Delete(':id')
  @RequirePermission('TEAM_MANAGE')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user
    return this.users.remove(user, id)
  }
}
