import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { IsArray, IsObject } from 'class-validator'
import { Request } from 'express'
import { AccessControlService } from './access-control.service'
import { RequirePermission } from './require-permission.decorator'
import { PermissionGuard } from './permission.guard'
import { PermissionKey, TenantRole } from './permissions'

class RolePermissionsDto { @IsArray() permissions: PermissionKey[] }
class UserOverridesDto { @IsObject() overrides: Partial<Record<PermissionKey, boolean>> }

@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('access-control')
export class AccessControlController {
  constructor(private readonly access: AccessControlService) {}

  @Get('me')
  me(@Req() req: Request) { return this.access.current((req as any).user) }

  @Get()
  @RequirePermission('ACCESS_MANAGE')
  configuration(@Req() req: Request) { return this.access.configuration((req as any).user) }

  @Put('roles/:role')
  @RequirePermission('ACCESS_MANAGE')
  updateRole(@Req() req: Request, @Param('role') role: TenantRole, @Body() dto: RolePermissionsDto) {
    return this.access.updateRole((req as any).user, role, dto.permissions)
  }

  @Put('users/:id')
  @RequirePermission('ACCESS_MANAGE')
  updateUser(@Req() req: Request, @Param('id') id: string, @Body() dto: UserOverridesDto) {
    return this.access.updateUser((req as any).user, id, dto.overrides)
  }
}
