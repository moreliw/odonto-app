import { Global, Module } from '@nestjs/common'
import { AccessControlController } from './access-control.controller'
import { AccessControlService } from './access-control.service'
import { PermissionGuard } from './permission.guard'

@Global()
@Module({
  controllers: [AccessControlController],
  providers: [AccessControlService, PermissionGuard],
  exports: [AccessControlService, PermissionGuard]
})
export class AccessControlModule {}
