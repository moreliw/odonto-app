import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { MasterPrismaService } from './modules/tenancy/master-prisma.service'

@Controller('health')
export class HealthController {
  constructor(private readonly master: MasterPrismaService) {}

  @Get()
  async status() {
    try {
      await this.master.$queryRaw`SELECT 1`
      return {
        ok: true,
        service: 'odonto-backend',
        environment: process.env.APP_ENV || 'unknown',
        database: 'ready'
      }
    } catch {
      throw new ServiceUnavailableException('Banco master indisponível.')
    }
  }
}
