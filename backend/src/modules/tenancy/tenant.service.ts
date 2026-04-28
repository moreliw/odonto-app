import { Injectable } from '@nestjs/common'
import { MasterPrismaService } from './master-prisma.service'
import { SubscriptionStatus } from '@prisma/client-master'

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

  async getAccessPolicyBySubdomain(subdomain: string) {
    const tenant = await this.master.tenant.findUnique({
      where: { subdomain },
      include: { subscription: true }
    })
    if (!tenant) return { allowed: false, reason: 'TENANT_NOT_FOUND' as const }
    const legacyAllow = process.env.SAAS_ALLOW_LEGACY_WITHOUT_SUBSCRIPTION !== 'false'
    if (!tenant.subscription && legacyAllow) {
      return {
        allowed: true,
        status: 'ACTIVE' as SubscriptionStatus,
        reason: null
      }
    }
    const status: SubscriptionStatus | 'PENDING' = tenant.subscription?.status || 'PENDING'
    const allowed = status === 'ACTIVE' || status === 'TRIAL'
    return {
      allowed,
      status,
      reason: allowed ? null : ('SUBSCRIPTION_BLOCKED' as const)
    }
  }
}
