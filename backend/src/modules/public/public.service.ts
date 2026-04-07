import { Injectable, UnauthorizedException } from '@nestjs/common'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { AuthService } from '../auth/auth.service'
import { RequestContext } from '../tenancy/request-context'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'

function isEmailIdentifier(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

@Injectable()
export class PublicService {
  constructor(private readonly provision: TenantProvisionService, private readonly master: MasterPrismaService, private readonly auth: AuthService) {}

  async signup({ name, adminEmail, adminPassword, plan }: { name: string; adminEmail: string; adminPassword: string; plan: 'BASIC' | 'PRO' }) {
    const result = await this.provision.provision({ name, adminEmail, adminPassword })
    const priceCents = plan === 'PRO' ? 9900 : 4900
    const tenant = await this.master.tenant.findUnique({ where: { slug: result.slug } })
    if (!tenant) throw new Error('Tenant not found after provision')
    await this.master.subscription.create({ data: { tenantId: tenant.id, plan, priceCents } })
    await this.master.loginIdentity.create({ data: { email: adminEmail, tenantId: tenant.id } })
    return { ok: true, subdomain: result.subdomain, slug: result.slug }
  }

  async loginByIdentifier(identifier: string, password: string) {
    const normalized = identifier.trim()
    if (!normalized || !password) throw new UnauthorizedException('Credenciais inválidas')

    const useSqlite = process.env.DEV_SQLITE === 'true'
    let tenantCandidates: Array<{ id: string; slug: string; subdomain: string; dbName: string; dbHost: string; dbPort: number; dbUser: string; dbPassword: string }> = []

    if (isEmailIdentifier(normalized)) {
      const li = await this.master.loginIdentity.findUnique({ where: { email: normalized } })
      if (li) {
        const tenant = await this.master.tenant.findUnique({ where: { id: li.tenantId } })
        if (tenant) tenantCandidates = [tenant]
      }
    }

    if (!tenantCandidates.length) {
      const tenants = await this.master.tenant.findMany({ orderBy: { createdAt: 'desc' } })
      for (const tenant of tenants) {
        const connectionString = useSqlite
          ? `file:./prisma/dev-${tenant.slug}.db`
          : `postgresql://${encodeURIComponent(tenant.dbUser)}:${encodeURIComponent(tenant.dbPassword)}@${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}?schema=public`
        const tenantPrisma = new TenantPrisma({ datasources: { db: { url: connectionString } } })
        try {
          const found = await tenantPrisma.user.findFirst({
            where: {
              OR: [
                { username: { equals: normalized, mode: 'insensitive' } },
                { email: { equals: normalized, mode: 'insensitive' } }
              ]
            },
            select: { id: true }
          })
          if (found) {
            tenantCandidates = [tenant]
            break
          }
        } catch (e) {
          continue
        } finally {
          await tenantPrisma.$disconnect()
        }
      }
    }

    if (!tenantCandidates.length) throw new UnauthorizedException('Credenciais inválidas')
    const tenant = tenantCandidates[0]
    const connectionString = useSqlite
      ? `file:./prisma/dev-${tenant.slug}.db`
      : `postgresql://${encodeURIComponent(tenant.dbUser)}:${encodeURIComponent(tenant.dbPassword)}@${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}?schema=public`

    return await new Promise((resolve, reject) => {
      RequestContext.run({ subdomain: tenant.subdomain, slug: tenant.slug, dbName: tenant.dbName, connectionString }, async () => {
        try {
          const res = await this.auth.login(normalized, password)
          resolve({ ...res, tenant: tenant.slug, subdomain: tenant.subdomain })
        } catch (e) {
          reject(new UnauthorizedException('Credenciais inválidas'))
        }
      })
    })
  }
}
