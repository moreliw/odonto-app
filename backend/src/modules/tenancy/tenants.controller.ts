import { Body, Controller, Headers, Post } from '@nestjs/common'
import { TenantProvisionService } from './tenant-provision.service'
import { IsEmail, IsString } from 'class-validator'

class ProvisionDto {
  @IsString()
  name: string
  @IsEmail()
  adminEmail: string
  @IsString()
  adminPassword: string
}

@Controller('tenants')
export class TenantsController {
  constructor(private readonly provision: TenantProvisionService) {}
  @Post('provision')
  async provisionTenant(@Headers('x-admin-token') token: string, @Body() dto: ProvisionDto) {
    if (!token || token !== process.env.MASTER_ADMIN_TOKEN) throw new Error('Unauthorized')
    return this.provision.provision({ name: dto.name, adminEmail: dto.adminEmail, adminPassword: dto.adminPassword })
  }
}
