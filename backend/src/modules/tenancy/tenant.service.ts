import { Injectable } from '@nestjs/common'
import { MasterPrismaService } from './master-prisma.service'

@Injectable()
export class TenantService {
  constructor(private readonly master: MasterPrismaService) {}

  async findBySubdomain(subdomain: string) {
    const t = await this.master.tenant.findUnique({ where: { subdomain } })
    if (!t) return null
    if (process.env.DEV_SQLITE === 'true') {
      const url = `file:./prisma/dev-${t.slug}.db`
      return { subdomain: t.subdomain, slug: t.slug, dbName: t.dbName, connectionString: url }
    }
    const url = `postgresql://${encodeURIComponent(t.dbUser)}:${encodeURIComponent(t.dbPassword)}@${t.dbHost}:${t.dbPort}/${t.dbName}?schema=public`
    return { subdomain: t.subdomain, slug: t.slug, dbName: t.dbName, connectionString: url }
  }
}
