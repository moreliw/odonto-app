import { execSync } from 'child_process'
import { PrismaClient as MasterPrisma } from '../backend/node_modules/@prisma/client-master'
import { PrismaClient as TenantPrisma } from '../backend/node_modules/@prisma/client-tenant'
import { Client as PgClient } from 'pg'

function arg(name: string) {
  const a = process.argv.find(x => x.startsWith(`--${name}=`))
  if (!a) return ''
  return a.split('=')[1]
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

function usernameFromEmail(email: string) {
  const raw = email.split('@')[0] || 'admin'
  return raw.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
}

async function main() {
  const name = arg('name')
  if (!name) throw new Error('Missing --name')
  const slugArg = arg('slug')
  const subdomainArg = arg('subdomain')
  const slug = slugArg || slugify(name)
  const subdomain = subdomainArg || slug
  const masterUrl = process.env.MASTER_DATABASE_URL || ''
  if (!masterUrl) throw new Error('Missing MASTER_DATABASE_URL')
  const pg = new PgClient({ connectionString: masterUrl })
  await pg.connect()
  const dbName = `tenant_${slug}`
  await pg.query(`CREATE DATABASE ${dbName}`)
  await pg.end()
  const master = new MasterPrisma({ datasources: { db: { url: masterUrl } } })
  const dbHost = arg('dbHost') || 'postgres-master'
  const dbPort = Number(arg('dbPort') || '5432')
  const dbUser = arg('dbUser') || process.env.POSTGRES_USER || 'postgres'
  const dbPassword = arg('dbPassword') || process.env.POSTGRES_PASSWORD || 'postgres'
  await master.tenant.create({ data: { name, slug, subdomain, dbName, dbHost, dbPort, dbUser, dbPassword } })
  await master.$disconnect()
  const tenantUrl = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}?schema=public`
  execSync(`npx prisma db push --schema=backend/prisma/tenant.schema.prisma`, { stdio: 'inherit', env: { ...process.env, TENANT_DATABASE_URL: tenantUrl } })
  const tenantPrisma = new TenantPrisma({ datasources: { db: { url: tenantUrl } } })
  const adminEmail = arg('adminEmail') || `admin@${subdomain}.local`
  const adminPass = arg('adminPassword') || 'admin123'
  const adminUsername = arg('adminUsername') || usernameFromEmail(adminEmail)
  const argon2 = await import('argon2')
  const hash = await argon2.default.hash(adminPass)
  await tenantPrisma.user.create({ data: { username: adminUsername, email: adminEmail, name: 'Administrator', passwordHash: hash, role: 'ADMIN' } })
  await tenantPrisma.$disconnect()
  process.stdout.write(JSON.stringify({ ok: true, slug, subdomain, dbName }) + '\n')
}

main().catch(err => {
  process.stderr.write(err.message + '\n')
  process.exit(1)
})
