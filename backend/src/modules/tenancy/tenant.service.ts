import { Injectable } from '@nestjs/common'
import { MasterPrismaService } from './master-prisma.service'
import { SubscriptionStatus } from '@prisma/client-master'

@Injectable()
export class TenantService {
  constructor(private readonly master: MasterPrismaService) {}

  private activeGrant<T extends { active: boolean; expiresAt: Date | null }>(grant: T | null | undefined) {
    return grant?.active && (!grant.expiresAt || grant.expiresAt.getTime() > Date.now()) ? grant : null
  }

  async findBySubdomain(subdomain: string) {
    const t = await this.master.tenant.findUnique({
      where: { subdomain },
      include: {
        subscription: { select: { plan: true } },
        accessGrant: { select: { plan: true, dentistLimit: true, active: true, expiresAt: true } }
      }
    })
    if (!t) return null
    const grant = this.activeGrant(t.accessGrant)
    const plan = grant?.plan ?? t.subscription?.plan ?? null
    const dentistLimit = grant ? grant.dentistLimit : undefined
    const branding = { name: t.name, primaryColor: t.primaryColor, logoUrl: t.logoUrl }
    if (process.env.DEV_SQLITE === 'true') {
      const url = `file:./prisma/dev-${t.slug}.db`
      return { id: t.id, subdomain: t.subdomain, slug: t.slug, dbName: t.dbName, connectionString: url, plan, dentistLimit, ...branding }
    }
    const url = `postgresql://${encodeURIComponent(t.dbUser)}:${encodeURIComponent(t.dbPassword)}@${t.dbHost}:${t.dbPort}/${t.dbName}?schema=public`
    return { id: t.id, subdomain: t.subdomain, slug: t.slug, dbName: t.dbName, connectionString: url, plan, dentistLimit, ...branding }
  }

  /** Dados públicos de identidade visual da clínica (sem exigir autenticação). */
  async getBranding(subdomain: string) {
    if (!subdomain) return { name: null, primaryColor: null, logoUrl: null }
    const t = await this.master.tenant.findUnique({
      where: { subdomain },
      select: { name: true, primaryColor: true, logoUrl: true }
    })
    return t || { name: null, primaryColor: null, logoUrl: null }
  }

  async getAccessPolicyBySubdomain(subdomain: string) {
    const tenant = await this.master.tenant.findUnique({
      where: { subdomain },
      include: { subscription: true, accessGrant: true }
    })
    if (!tenant) return { allowed: false, reason: 'TENANT_NOT_FOUND' as const }
    const grant = this.activeGrant(tenant.accessGrant)
    if (grant) {
      return {
        allowed: true,
        status: 'ACTIVE' as SubscriptionStatus,
        reason: 'MASTER_ACCESS_GRANT' as const,
        accessGrant: grant
      }
    }
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
