import { execSync } from 'child_process'
import { PrismaClient as Master } from '../backend/node_modules/@prisma/client-master'
import { PrismaClient as Tenant } from '../backend/node_modules/@prisma/client-tenant'
import * as argon2 from '../backend/node_modules/argon2'

const masterUrl = 'file:./prisma/dev-master.db'
const tenantSlug = 'clinicax'
const tenantDb = `file:./prisma/dev-${tenantSlug}.db`

function run(cmd: string, env: Record<string, string> = {}) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: __dirname + '/../backend', env: { ...process.env, ...env } })
}

async function main() {
  // Assume schemas and clients are already generated during dev setup

  // Seed master
  const master = new Master({ datasources: { db: { url: masterUrl } } })
  const slug = tenantSlug
  const subdomain = tenantSlug
  await master.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      name: 'Clínica X',
      slug,
      subdomain,
      dbName: 'dev',
      dbHost: 'localhost',
      dbPort: 0,
      dbUser: 'dev',
      dbPassword: 'dev'
    }
  })
  const mt = await master.tenant.findUnique({ where: { slug } })

  // Seed tenant admin
  const tenant = new Tenant({ datasources: { db: { url: tenantDb } } })
  const email = 'admin@demo.local'
  const password = 'admin123'
  const hash = await argon2.hash(password)
  await tenant.user.upsert({
    where: { email },
    update: { passwordHash: hash },
    create: { email, name: 'Admin', passwordHash: hash, role: 'ADMIN' as any }
  })
  if (mt) {
    await master.loginIdentity.upsert({ where: { email }, update: { tenantId: mt.id }, create: { email, tenantId: mt.id } })
  }
  // sample patient
  await tenant.patient.create({ data: { name: 'Paciente Demo', email: 'paciente.demo@example.com' } })
  await master.$disconnect()
  await tenant.$disconnect()
  console.log('Seed concluído. Tenant: clinicax, admin: admin@demo.local / admin123')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
