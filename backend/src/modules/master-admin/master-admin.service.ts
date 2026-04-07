import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { Plan, SubscriptionStatus } from '@prisma/client-master'

@Injectable()
export class MasterAdminService {
  constructor(
    private readonly jwt: JwtService,
    private readonly master: MasterPrismaService,
    private readonly provision: TenantProvisionService
  ) {}

  login(email: string, password: string) {
    const masterEmail = process.env.MASTER_SUPERADMIN_EMAIL || 'admin@odontoapp.com'
    const masterPassword = process.env.MASTER_SUPERADMIN_PASSWORD || 'Admin@123456'
    if (email !== masterEmail || password !== masterPassword) {
      throw new UnauthorizedException('Credenciais inválidas')
    }
    const accessToken = this.jwt.sign(
      { sub: masterEmail, scope: 'MASTER_ADMIN' },
      { secret: process.env.JWT_SECRET || 'secret', expiresIn: '12h' }
    )
    return { accessToken, user: { email: masterEmail, name: 'Master Admin', role: 'MASTER_ADMIN' } }
  }

  async listClinics() {
    return this.master.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
        loginIdentities: { select: { email: true } }
      }
    })
  }

  async createClinic(data: { name: string; subdomain?: string; adminEmail: string; adminPassword: string; plan: Plan; priceCents: number }) {
    const provisioned = await this.provision.provision({
      name: data.name,
      subdomain: data.subdomain,
      adminEmail: data.adminEmail,
      adminPassword: data.adminPassword
    })
    const tenant = await this.master.tenant.findUnique({ where: { slug: provisioned.slug } })
    if (!tenant) throw new Error('Falha ao localizar clínica provisionada')
    await this.master.loginIdentity.upsert({
      where: { email: data.adminEmail },
      update: { tenantId: tenant.id },
      create: { email: data.adminEmail, tenantId: tenant.id }
    })
    const subscription = await this.master.subscription.upsert({
      where: { tenantId: tenant.id },
      update: { plan: data.plan, priceCents: data.priceCents, status: 'ACTIVE' },
      create: { tenantId: tenant.id, plan: data.plan, priceCents: data.priceCents, status: 'ACTIVE' }
    })
    return { tenant, subscription }
  }

  async updateClinic(id: string, data: { name?: string; subdomain?: string; plan?: Plan; status?: SubscriptionStatus; priceCents?: number }) {
    const tenant = await this.master.tenant.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.subdomain ? { subdomain: data.subdomain } : {})
      }
    })
    const subscription = await this.master.subscription.upsert({
      where: { tenantId: id },
      update: {
        ...(data.plan ? { plan: data.plan } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(typeof data.priceCents === 'number' ? { priceCents: data.priceCents } : {})
      },
      create: {
        tenantId: id,
        plan: data.plan || 'BASIC',
        status: data.status || 'ACTIVE',
        priceCents: typeof data.priceCents === 'number' ? data.priceCents : 4900
      }
    })
    return { tenant, subscription }
  }

  async financeSummary() {
    const subscriptions = await this.master.subscription.findMany({ include: { tenant: true }, orderBy: { startedAt: 'desc' } })
    const activeStatuses: SubscriptionStatus[] = ['ACTIVE', 'TRIAL']
    const active = subscriptions.filter(item => activeStatuses.includes(item.status))
    const mrrCents = active.reduce((acc, item) => acc + item.priceCents, 0)
    const byPlan = {
      BASIC: subscriptions.filter(item => item.plan === 'BASIC').length,
      PRO: subscriptions.filter(item => item.plan === 'PRO').length
    }
    const byStatus = {
      ACTIVE: subscriptions.filter(item => item.status === 'ACTIVE').length,
      TRIAL: subscriptions.filter(item => item.status === 'TRIAL').length,
      PAST_DUE: subscriptions.filter(item => item.status === 'PAST_DUE').length,
      CANCELED: subscriptions.filter(item => item.status === 'CANCELED').length
    }
    return {
      totals: {
        clinics: subscriptions.length,
        activeClinics: active.length,
        mrrCents
      },
      byPlan,
      byStatus,
      recentSubscriptions: subscriptions.slice(0, 12)
    }
  }
}
