import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AccessControlService } from './access-control.service'
import { REQUIRED_PERMISSION } from './require-permission.decorator'
import { PermissionKey } from './permissions'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly access: AccessControlService) {}
  async canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<PermissionKey>(REQUIRED_PERMISSION, [context.getHandler(), context.getClass()])
    if (!permission) return true
    const requester = context.switchToHttp().getRequest().user
    if (!requester) return false
    await this.access.assertPermission(requester, permission)
    return true
  }
}

