import { Injectable } from '@nestjs/common'
import { execSync } from 'child_process'
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

@Injectable()
export class TenantProvisionService {
  constructor(private readonly master: MasterPrismaService) {}

  async provision({ name, subdomain, adminEmail, adminPassword }: { name: string; subdomain?: string; adminEmail: string; adminPassword: string }) {
    const slug = slugify(name)
    const s = subdomain || slug
    const masterUrl = process.env.MASTER_DATABASE_URL || ''
    if (!masterUrl) throw new Error('Missing MASTER_DATABASE_URL')
    const dbName = `tenant_${slug}`
    const pg = new PgClient({ connectionString: masterUrl })
    await pg.connect()
    await pg.query(`CREATE DATABASE ${quotePgIdent(dbName)}`)
    await pg.end()
    const dbHost = process.env.DB_HOST || 'postgres-master'
    const dbPort = Number(process.env.DB_PORT || '5432')
    const dbUser = process.env.POSTGRES_USER || 'postgres'
    const dbPassword = process.env.POSTGRES_PASSWORD || 'postgres'
    await this.master.tenant.create({ data: { name, slug, subdomain: s, dbName, dbHost, dbPort, dbUser, dbPassword } })
    const tenantUrl = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}?schema=public`

    // Apply tenant schema to the newly created database
    execSync('npx prisma db push --schema=prisma/tenant.schema.prisma --skip-generate --accept-data-loss', {
      env: { ...process.env, TENANT_DATABASE_URL: tenantUrl },
      stdio: 'pipe'
    })

    // Create default admin user
    const tenantPrisma = new TenantPrisma({ datasources: { db: { url: tenantUrl } } })
    try {
      const hash = await argon2.hash(adminPassword)
      await tenantPrisma.user.create({ data: { username: usernameFromEmail(adminEmail), email: adminEmail, name: 'Administrator', passwordHash: hash, role: 'ADMIN' } })
    } finally {
      await tenantPrisma.$disconnect()
    }
    return { ok: true, slug, subdomain: s, dbName }
  }
}
