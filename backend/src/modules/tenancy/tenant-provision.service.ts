import { Injectable } from '@nestjs/common'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { Client as PgClient } from 'pg'
import { MasterPrismaService } from './master-prisma.service'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'
import * as argon2 from 'argon2'

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

function usernameFromEmail(email: string) {
  const raw = email.split('@')[0] || 'admin'
  return slugify(raw).replace(/-/g, '_')
}

/** Nomes com hífen exigem aspas no PostgreSQL: CREATE DATABASE "tenant_x-y" */
function quotePgIdent(ident: string) {
  return '"' + ident.replace(/"/g, '""') + '"'
}

/** Mesmas credenciais do master; evita POSTGRES_* ausentes no container (defaults postgres/postgres ≠ MASTER_DATABASE_URL). */
function tenantConnectionUrlFromMaster(masterDatabaseUrl: string, dbName: string) {
  const u = new URL(masterDatabaseUrl)
  u.pathname = '/' + dbName.replace(/^\//, '')
  return u.toString()
}

function tenantMetaFromMasterUrl(masterDatabaseUrl: string, dbName: string) {
  const u = new URL(masterDatabaseUrl)
  return {
    dbHost: u.hostname,
    dbPort: u.port ? Number(u.port) : 5432,
    /** URL.username/password já vêm decodificados no Node */
    dbUser: u.username || 'postgres',
    dbPassword: u.password || '',
    tenantUrl: tenantConnectionUrlFromMaster(masterDatabaseUrl, dbName)
  }
}

@Injectable()
export class TenantProvisionService {
  constructor(private readonly master: MasterPrismaService) {}

  async provision({
    name,
    subdomain,
    adminEmail,
    adminPassword,
    adminPasswordHash,
    adminName,
    signupIntentId
  }: {
    name: string
    subdomain?: string
    adminEmail: string
    adminPassword?: string
    adminPasswordHash?: string
    adminName?: string
    signupIntentId?: string
  }) {
    if (!adminPassword && !adminPasswordHash) throw new Error('Missing admin password data')
    // Different clinics can have the same name. Their unique address is the
    // database identity; using the display name caused CREATE DATABASE collisions.
    const s = subdomain || slugify(name)
    const slug = s
    const masterUrl = process.env.MASTER_DATABASE_URL || ''
    if (!masterUrl) throw new Error('Missing MASTER_DATABASE_URL')
    const dbName = `tenant_${slug}`
    const { dbHost, dbPort, dbUser, dbPassword, tenantUrl } = tenantMetaFromMasterUrl(masterUrl, dbName)

    const pg = new PgClient({ connectionString: masterUrl })
    let dbCreated = false
    let tenantRowId: string | null = null
    try {
      await pg.connect()
      await pg.query(`CREATE DATABASE ${quotePgIdent(dbName)}`)
      dbCreated = true
      await pg.end()

      await promisify(execFile)(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema=prisma/tenant.schema.prisma', '--skip-generate'], {
        env: { ...process.env, TENANT_DATABASE_URL: tenantUrl },
        timeout: 90_000,
        maxBuffer: 2 * 1024 * 1024
      })

      const tenant = await this.master.tenant.create({
        data: { name, slug, subdomain: s, dbName, dbHost, dbPort, dbUser, dbPassword, provisionSignupIntentId: signupIntentId }
      })
      tenantRowId = tenant.id

      const tenantPrisma = new TenantPrisma({ datasources: { db: { url: tenantUrl } } })
      try {
        const hash = adminPasswordHash || (await argon2.hash(adminPassword!))
        await tenantPrisma.user.create({
          data: {
            username: usernameFromEmail(adminEmail),
            email: adminEmail,
            name: adminName?.trim() || 'Administrator',
            passwordHash: hash,
            role: 'ADMIN'
          }
        })
      } finally {
        await tenantPrisma.$disconnect()
      }

      return { ok: true, slug, subdomain: s, dbName }
    } catch (err) {
      if (tenantRowId) {
        try {
          await this.master.tenant.delete({ where: { id: tenantRowId } })
        } catch {
          /* ignore */
        }
      }
      if (dbCreated) {
        const drop = new PgClient({ connectionString: masterUrl })
        try {
          await drop.connect()
          await drop.query(`DROP DATABASE IF EXISTS ${quotePgIdent(dbName)}`)
        } catch {
          /* ignore */
        } finally {
          await drop.end().catch(() => {})
        }
      } else {
        await pg.end().catch(() => {})
      }
      throw err
    }
  }

  /** Recover a crash between creating the tenant row and its first user. */
  async ensureSignupAdmin(dbName: string, input: { email: string; name: string; passwordHash: string }) {
    const url = tenantConnectionUrlFromMaster(process.env.MASTER_DATABASE_URL!, dbName)
    const db = new TenantPrisma({ datasources: { db: { url } } })
    try {
      await db.user.upsert({ where: { email: input.email }, update: {}, create: {
        email: input.email, name: input.name, username: usernameFromEmail(input.email), passwordHash: input.passwordHash, role: 'ADMIN'
      } })
    } finally { await db.$disconnect() }
  }

  /** Apaga o banco de dados físico da clínica. Chamado após remover o Tenant do master — irreversível. */
  async deprovision({ slug, dbName }: { slug: string; dbName: string }) {
    if (process.env.DEV_SQLITE === 'true') {
      const fs = await import('fs/promises')
      await fs.unlink(`./prisma/dev-${slug}.db`).catch(() => undefined)
      return
    }
    const masterUrl = process.env.MASTER_DATABASE_URL || ''
    if (!masterUrl) throw new Error('Missing MASTER_DATABASE_URL')
    const pg = new PgClient({ connectionString: masterUrl })
    try {
      await pg.connect()
      try {
        // WITH (FORCE) encerra conexões ativas antes de dropar (Postgres 13+).
        await pg.query(`DROP DATABASE IF EXISTS ${quotePgIdent(dbName)} WITH (FORCE)`)
      } catch {
        await pg.query(`DROP DATABASE IF EXISTS ${quotePgIdent(dbName)}`)
      }
    } finally {
      await pg.end().catch(() => undefined)
    }
  }
}
