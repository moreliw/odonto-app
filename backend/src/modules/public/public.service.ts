import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { AuthService } from '../auth/auth.service'
import { Prisma as PrismaMaster, SubscriptionStatus } from '@prisma/client-master'
import { Prisma as PrismaTenant } from '@prisma/client-tenant'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'
import { PrismaClient as MasterPrisma } from '@prisma/client-master'

function isEmailIdentifier(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Mesma origem que o provisionamento: credenciais na linha Tenant costumam estar erradas no Docker se vierem de default postgres/postgres. */
function tenantDatabaseUrlForLogin(dbName: string): string | null {
  const masterUrl = process.env.MASTER_DATABASE_URL || ''
  if (!masterUrl) return null
  const u = new URL(masterUrl)
  u.pathname = '/' + dbName.replace(/^\//, '')
  return u.toString()
}

function tenantConnectionString(
  tenant: { slug: string; dbName: string; dbHost: string; dbPort: number; dbUser: string; dbPassword: string },
  useSqlite: boolean
): string {
  if (useSqlite) return `file:./prisma/dev-${tenant.slug}.db`
  const fromMaster = tenantDatabaseUrlForLogin(tenant.dbName)
  if (fromMaster) return fromMaster
  return `postgresql://${encodeURIComponent(tenant.dbUser)}:${encodeURIComponent(tenant.dbPassword)}@${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}?schema=public`
}

/** 401 aqui: falha de autenticação da clínica (sem detalhes internos para o usuário final). */
const CLINIC_LOGIN_FAIL = 'Não foi possível entrar. Verifique e-mail ou usuário e senha.'

@Injectable()
export class PublicService {
  private readonly log = new Logger(PublicService.name)

  constructor(private readonly provision: TenantProvisionService, private readonly master: MasterPrismaService, private readonly auth: AuthService) {}

  private isMasterAuthError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return message.includes('Authentication failed against database server')
  }

  private buildMasterDatabaseUrls() {
    const urls = new Set<string>()
    if (process.env.MASTER_DATABASE_URL) urls.add(process.env.MASTER_DATABASE_URL)
    const user = process.env.POSTGRES_USER || 'postgres'
    const host = process.env.MASTER_DB_HOST || 'postgres-master'
    const port = process.env.MASTER_DB_PORT || '5432'
    const passwordFromEnv = process.env.POSTGRES_PASSWORD || ''
    if (passwordFromEnv) {
      urls.add(`postgresql://${encodeURIComponent(user)}:${encodeURIComponent(passwordFromEnv)}@${host}:${port}/master?schema=public`)
    }
    urls.add(`postgresql://${encodeURIComponent(user)}:${encodeURIComponent('postgres')}@${host}:${port}/master?schema=public`)
    return Array.from(urls)
  }

  private async queryMaster<T>(query: (db: MasterPrismaService | MasterPrisma) => Promise<T>): Promise<T> {
    try {
      return await query(this.master)
    } catch (error) {
      if (!this.isMasterAuthError(error)) throw error
      let lastError: unknown = error
      const primaryUrl = process.env.MASTER_DATABASE_URL || ''
      for (const url of this.buildMasterDatabaseUrls()) {
        if (!url || url === primaryUrl) continue
        const fallback = new MasterPrisma({ datasources: { db: { url } } })
        try {
          return await query(fallback)
        } catch (fallbackError) {
          lastError = fallbackError
        } finally {
          await fallback.$disconnect()
        }
      }
      throw lastError
    }
  }

  async signup({ name, adminEmail, adminPassword, plan }: { name: string; adminEmail: string; adminPassword: string; plan: 'BASIC' | 'PRO' }) {
    const result = await this.provision.provision({ name, adminEmail, adminPassword })
    const priceCents = plan === 'PRO' ? 9900 : 4900
    const tenant = await this.queryMaster(db => db.tenant.findUnique({ where: { slug: result.slug } }))
    if (!tenant) throw new Error('Tenant not found after provision')
    await this.queryMaster(db => db.subscription.create({ data: { tenantId: tenant.id, plan, priceCents, status: 'ACTIVE' } }))
    await this.queryMaster(db => db.loginIdentity.create({ data: { email: adminEmail, tenantId: tenant.id } }))
    return { ok: true, subdomain: result.subdomain, slug: result.slug }
  }

  private masterSuperadminEmail() {
    return (process.env.MASTER_SUPERADMIN_EMAIL || 'admin@odontoapp.com').toLowerCase()
  }

  private async assertTenantAccess(tenantId: string) {
    const sub = await this.queryMaster(db => db.subscription.findUnique({ where: { tenantId } }))
    const status: SubscriptionStatus | 'PENDING' = sub?.status || 'PENDING'
    if (status === 'ACTIVE' || status === 'TRIAL') return
    const label: Record<SubscriptionStatus | 'PENDING', string> = {
      ACTIVE: 'ativa',
      TRIAL: 'em trial',
      PAST_DUE: 'em atraso',
      CANCELED: 'cancelada',
      PENDING: 'pendente'
    }
    throw new UnauthorizedException(`A assinatura da sua clínica está ${label[status]}. Regularize para continuar.`)
  }

  async loginByIdentifier(identifier: string, password: string) {
    const normalized = identifier.trim()
    if (!normalized || !password) {
      throw new UnauthorizedException('Informe e-mail ou usuário e a senha.')
    }

    if (isEmailIdentifier(normalized) && normalized.toLowerCase() === this.masterSuperadminEmail()) {
      throw new UnauthorizedException('Este e-mail não é de acesso à clínica. Use o e-mail do cadastro da sua clínica.')
    }

    const useSqlite = process.env.DEV_SQLITE === 'true'
    let tenantCandidates: Array<{ id: string; slug: string; subdomain: string; dbName: string; dbHost: string; dbPort: number; dbUser: string; dbPassword: string }> = []

    if (isEmailIdentifier(normalized)) {
      const rows = await this.queryMaster(db =>
        db.$queryRaw<Array<{ tenantId: string }>>(
          PrismaMaster.sql`SELECT "tenantId" FROM "LoginIdentity" WHERE LOWER(email) = LOWER(${normalized}) LIMIT 1`
        )
      )
      const tenantId = rows[0]?.tenantId
      if (tenantId) {
        const tenant = await this.queryMaster(db => db.tenant.findUnique({ where: { id: tenantId } }))
        if (tenant) tenantCandidates = [tenant]
      }
    }

    if (!tenantCandidates.length) {
      const tenants = await this.queryMaster(db => db.tenant.findMany({ orderBy: { createdAt: 'desc' } }))
      for (const tenant of tenants) {
        const connectionString = tenantConnectionString(tenant, useSqlite)
        const tenantPrisma = new TenantPrisma({ datasources: { db: { url: connectionString } } })
        try {
          let hit: { id: string } | null | undefined
          if (useSqlite) {
            hit = await tenantPrisma.user.findFirst({
              where: {
                OR: [
                  { username: { equals: normalized, mode: 'insensitive' } },
                  { email: { equals: normalized, mode: 'insensitive' } }
                ]
              },
              select: { id: true }
            })
          } else {
            const rows = await tenantPrisma.$queryRaw<Array<{ id: string }>>(
              PrismaTenant.sql`SELECT id FROM "User" WHERE LOWER(COALESCE(username,'')) = LOWER(${normalized}) OR LOWER(COALESCE(email,'')) = LOWER(${normalized}) LIMIT 1`
            )
            hit = rows[0]
          }
          if (hit) {
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

    if (!tenantCandidates.length) throw new UnauthorizedException(CLINIC_LOGIN_FAIL)
    const tenant = tenantCandidates[0]
    await this.assertTenantAccess(tenant.id)
    const connectionString = tenantConnectionString(tenant, useSqlite)

    try {
      const res = await this.auth.loginWithTenantConnection(connectionString, normalized, password)
      return { ...res, tenant: tenant.slug, subdomain: tenant.subdomain }
    } catch (e) {
      this.log.error({ err: e }, 'public login failed')
      if (e instanceof UnauthorizedException) {
        throw new UnauthorizedException(CLINIC_LOGIN_FAIL)
      }
      throw e
    }
  }
}
