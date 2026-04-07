import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Module({
  controllers: [UsersController],
  providers: [UsersService, TenantPrismaService]
})
export class UsersModule {}
