import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { AuthService } from '../auth/auth.service'
import { Prisma as PrismaMaster } from '@prisma/client-master'
import { Prisma as PrismaTenant } from '@prisma/client-tenant'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'
import { PrismaClient as MasterPrisma } from '@prisma/client-master'

function isEmailIdentifier(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Mensagem única: 401 aqui não é “falta de token”; é falha de autenticação da clínica. */
const CLINIC_LOGIN_FAIL =
  'Não foi possível entrar com estas credenciais da clínica. Verifique e-mail e senha, ou cadastre uma clínica. Super administrador da plataforma: use /admin/login (não use esta tela).'

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
    await this.queryMaster(db => db.subscription.create({ data: { tenantId: tenant.id, plan, priceCents } }))
    await this.queryMaster(db => db.loginIdentity.create({ data: { email: adminEmail, tenantId: tenant.id } }))
    return { ok: true, subdomain: result.subdomain, slug: result.slug }
  }

  private masterSuperadminEmail() {
    return (process.env.MASTER_SUPERADMIN_EMAIL || 'admin@odontoapp.com').toLowerCase()
  }

  async loginByIdentifier(identifier: string, password: string) {
    const normalized = identifier.trim()
    if (!normalized || !password) {
      throw new UnauthorizedException(
        'Informe usuário ou e-mail e a senha. Esta rota não exige cabeçalho Authorization; 401 aqui significa dados incorretos ou tipo de conta errado.'
      )
    }

    if (isEmailIdentifier(normalized) && normalized.toLowerCase() === this.masterSuperadminEmail()) {
      throw new UnauthorizedException(
        'Este e-mail é do super administrador da plataforma. Abra /admin/login — não use o login da clínica (/login).'
      )
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
        const connectionString = useSqlite
          ? `file:./prisma/dev-${tenant.slug}.db`
          : `postgresql://${encodeURIComponent(tenant.dbUser)}:${encodeURIComponent(tenant.dbPassword)}@${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}?schema=public`
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
    const connectionString = useSqlite
      ? `file:./prisma/dev-${tenant.slug}.db`
      : `postgresql://${encodeURIComponent(tenant.dbUser)}:${encodeURIComponent(tenant.dbPassword)}@${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}?schema=public`

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
