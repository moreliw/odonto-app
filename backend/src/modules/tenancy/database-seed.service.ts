import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { MasterPrismaService } from './master-prisma.service'
import { TenantProvisionService } from './tenant-provision.service'

/**
 * Creates a default clinic on first boot when:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD and SEED_CLINIC_NAME are set
 * and no tenant exists yet in the master database.
 */
@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly log = new Logger(DatabaseSeedService.name)

  constructor(
    private readonly master: MasterPrismaService,
    private readonly provision: TenantProvisionService
  ) {}

  async onApplicationBootstrap() {
    const email = process.env.SEED_ADMIN_EMAIL?.trim()
    const password = process.env.SEED_ADMIN_PASSWORD?.trim()
    const clinicName = process.env.SEED_CLINIC_NAME?.trim() || 'Clínica Demo'

    if (!email || !password) return

    try {
      const count = await this.master.tenant.count()
      if (count > 0) return

      this.log.log(`Nenhum tenant encontrado. Criando clínica inicial: "${clinicName}" (${email})`)
      await this.provision.provision({ name: clinicName, adminEmail: email, adminPassword: password })
      await this.master.loginIdentity.upsert({
        where: { email },
        update: {},
        create: { email, tenantId: (await this.master.tenant.findFirst({ orderBy: { createdAt: 'desc' } }))!.id }
      })
      this.log.log('Clínica inicial criada com sucesso.')
    } catch (err) {
      this.log.error({ err }, 'Falha ao criar clínica inicial via seed. O sistema continuará sem ela.')
    }
  }
}
