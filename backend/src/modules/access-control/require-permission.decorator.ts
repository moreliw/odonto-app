import { SetMetadata } from '@nestjs/common'
import { PermissionKey } from './permissions'

export const REQUIRED_PERMISSION = 'required_permission'
export const RequirePermission = (permission: PermissionKey) => SetMetadata(REQUIRED_PERMISSION, permission)

