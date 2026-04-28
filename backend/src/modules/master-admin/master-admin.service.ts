import { Injectable, InternalServerErrorException, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { Plan, SubscriptionStatus, Tenant } from '@prisma/client-master'
import { BillingService } from '../billing/billing.service'

type SanitizedTenant = Omit<Tenant, 'dbPassword'> & { dbPassword?: never }

@Injectable()
export class MasterAdminService implements OnModuleInit {
  constructor(
    private readonly jwt: JwtService,
    private readonly master: MasterPrismaService,
    private readonly provision: TenantProvisionService,
    private readonly billing: BillingService
  ) {}

  onModuleInit() {
    if (!process.env.MASTER_SUPERADMIN_EMAIL || !process.env.MASTER_SUPERADMIN_PASSWORD) {
      throw new InternalServerErrorException('MASTER_SUPERADMIN_EMAIL e MASTER_SUPERADMIN_PASSWORD são obrigatórios')
    }
  }

  private sanitizeTenant<T extends Tenant>(row: T): SanitizedTenant {
    const { dbPassword: _p, ...rest } = row
    return rest as SanitizedTenant
  }

  private tenantDbUrl(t: Tenant) {
    if (process.env.DEV_SQLITE === 'true') {
      return `file:./prisma/dev-${t.slug}.db`
    }
    return `postgresql://${encodeURIComponent(t.dbUser)}:${encodeURIComponent(t.dbPassword)}@${t.dbHost}:${t.dbPort}/${t.dbName}?schema=public`
  }

  private async withTenantPrisma<T>(t: Tenant, fn: (prisma: TenantPrisma) => Promise<T>): Promise<T> {
    const url = this.tenantDbUrl(t)
    const prisma = new TenantPrisma({ datasources: { db: { url } } })
    try {
      return await fn(prisma)
    } finally {
      await prisma.$disconnect()
    }
  }

  login(email: string, password: string) {
    const masterEmail = process.env.MASTER_SUPERADMIN_EMAIL?.trim()
    const masterPassword = process.env.MASTER_SUPERADMIN_PASSWORD?.trim()
    if (!masterEmail || !masterPassword) {
      throw new InternalServerErrorException('Credenciais master não configuradas')
    }
    if (email.trim() !== masterEmail || password !== masterPassword) {
      throw new UnauthorizedException('Credenciais inválidas')
    }
    const accessToken = this.jwt.sign(
      { sub: masterEmail, scope: 'MASTER_ADMIN' },
      { secret: process.env.JWT_SECRET || 'secret', expiresIn: '12h' }
    )
    return { accessToken, user: { email: masterEmail, name: 'Super Administrador', role: 'MASTER_ADMIN' } }
  }

  async listClinics() {
    const rows = await this.master.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
        loginIdentities: { select: { email: true } }
      }
    })
    return rows.map(r => ({
      ...this.sanitizeTenant(r),
      subscription: r.subscription,
      loginIdentities: r.loginIdentities
    }))
  }

  async getClinic(id: string) {
    const row = await this.master.tenant.findUnique({
      where: { id },
      include: {
        subscription: true,
        loginIdentities: { select: { email: true, id: true, createdAt: true } }
      }
    })
    if (!row) throw new NotFoundException('Clínica não encontrada')
    let operations: Awaited<ReturnType<MasterAdminService['tenantOperationStats']>> | null = null
    try {
      operations = await this.tenantOperationStats(row)
    } catch {
      operations = null
    }
    return {
      ...this.sanitizeTenant(row),
      subscription: row.subscription,
      loginIdentities: row.loginIdentities,
      operations
    }
  }

  private async tenantOperationStats(t: Tenant) {
    return this.withTenantPrisma(t, async prisma => {
      const [patients, appointments, users, records, files, invoiceAgg, invoicesCount, apptByStatus] = await Promise.all([
        prisma.patient.count(),
        prisma.appointment.count(),
        prisma.user.count(),
        prisma.record.count(),
        prisma.file.count(),
        prisma.invoice.aggregate({ _sum: { amount: true } }),
        prisma.invoice.count(),
        prisma.appointment.groupBy({ by: ['status'], _count: { _all: true } })
      ])
      const invoiceTotal = invoiceAgg._sum.amount != null ? invoiceAgg._sum.amount.toString() : '0'
      return {
        patients,
        appointments,
        users,
        records,
        files,
        invoicesCount,
        invoicesAmountSum: invoiceTotal,
        appointmentsByStatus: apptByStatus.map(x => ({ status: x.status, count: x._count._all }))
      }
    })
  }

  async clinicOperations(id: string) {
    const row = await this.master.tenant.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Clínica não encontrada')
    try {
      return await this.tenantOperationStats(row)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao ler banco do tenant'
      return { error: message }
    }
  }

  async operationsOverview() {
    const tenants = await this.master.tenant.findMany({ orderBy: { name: 'asc' } })
    const clinics: Array<{
      tenantId: string
      name: string
      subdomain: string
      stats: Awaited<ReturnType<MasterAdminService['tenantOperationStats']>> | null
      error?: string
    }> = []
    const totals = {
      patients: 0,
      appointments: 0,
      users: 0,
      records: 0,
      files: 0,
      invoicesCount: 0
    }
    let invoiceDecimalSum = 0
    for (const t of tenants) {
      try {
        const stats = await this.tenantOperationStats(t)
        clinics.push({ tenantId: t.id, name: t.name, subdomain: t.subdomain, stats })
        totals.patients += stats.patients
        totals.appointments += stats.appointments
        totals.users += stats.users
        totals.records += stats.records
        totals.files += stats.files
        totals.invoicesCount += stats.invoicesCount
        invoiceDecimalSum += Number(stats.invoicesAmountSum || 0)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Falha na leitura'
        clinics.push({ tenantId: t.id, name: t.name, subdomain: t.subdomain, stats: null, error: message })
      }
    }
    return {
      totals: { ...totals, invoicesAmountSum: invoiceDecimalSum.toFixed(2) },
      clinics
    }
  }

  async financeClinics() {
    const subs = await this.master.subscription.findMany({
      include: { tenant: true },
      orderBy: { startedAt: 'desc' }
    })
    const activeStatuses: SubscriptionStatus[] = ['ACTIVE', 'TRIAL']
    return subs.map(s => {
      const t = s.tenant
      return {
        tenantId: t.id,
        name: t.name,
        subdomain: t.subdomain,
        slug: t.slug,
        plan: s.plan,
        status: s.status,
        provider: s.provider,
        providerSubscriptionId: s.providerSubscriptionId,
        priceCents: s.priceCents,
        currency: s.currency,
        startedAt: s.startedAt,
        activatedAt: s.activatedAt,
        lastPaymentAt: s.lastPaymentAt,
        currentPeriodEnd: s.currentPeriodEnd,
        renewsAt: s.renewsAt,
        canceledAt: s.canceledAt,
        countsForMrr: activeStatuses.includes(s.status)
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
    return { tenant: this.sanitizeTenant(tenant), subscription }
  }

  async updateClinic(
    id: string,
    data: {
      name?: string
      subdomain?: string
      internalNotes?: string | null
      plan?: Plan
      status?: SubscriptionStatus
      priceCents?: number
      currency?: string
      renewsAt?: string | null
      canceledAt?: string | null
    }
  ) {
    const existing = await this.master.tenant.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Clínica não encontrada')

    const tenantData: { name?: string; subdomain?: string; internalNotes?: string | null } = {}
    if (data.name !== undefined) tenantData.name = data.name
    if (data.subdomain !== undefined && data.subdomain !== '') tenantData.subdomain = data.subdomain
    if (data.internalNotes !== undefined) tenantData.internalNotes = data.internalNotes

    const tenant =
      Object.keys(tenantData).length > 0
        ? await this.master.tenant.update({ where: { id }, data: tenantData })
        : existing

    const subUpdate: Record<string, unknown> = {}
    if (data.plan !== undefined) subUpdate.plan = data.plan
    if (data.status !== undefined) subUpdate.status = data.status
    if (typeof data.priceCents === 'number') subUpdate.priceCents = data.priceCents
    if (data.currency !== undefined) subUpdate.currency = data.currency
    if (data.renewsAt !== undefined) {
      subUpdate.renewsAt = data.renewsAt === null || data.renewsAt === '' ? null : new Date(data.renewsAt)
    }
    if (data.canceledAt !== undefined) {
      subUpdate.canceledAt = data.canceledAt === null || data.canceledAt === '' ? null : new Date(data.canceledAt)
    }

    const subscription = await this.master.subscription.upsert({
      where: { tenantId: id },
      update: subUpdate as any,
      create: {
        tenantId: id,
        plan: data.plan || 'BASIC',
        status: data.status || 'ACTIVE',
        priceCents: typeof data.priceCents === 'number' ? data.priceCents : 12900,
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.renewsAt !== undefined && data.renewsAt
          ? { renewsAt: new Date(data.renewsAt) }
          : {}),
        ...(data.canceledAt !== undefined && data.canceledAt
          ? { canceledAt: new Date(data.canceledAt) }
          : {})
      }
    })

    return { tenant: this.sanitizeTenant(tenant), subscription }
  }

  async resetTenantAdminPassword(tenantId: string, newPassword: string, adminEmail?: string) {
    const tenant = await this.master.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new NotFoundException('Clínica não encontrada')
    const hash = await argon2.hash(newPassword)
    await this.withTenantPrisma(tenant, async prisma => {
      const user = adminEmail
        ? await prisma.user.findFirst({ where: { email: adminEmail, role: 'ADMIN' } })
        : await prisma.user.findFirst({ where: { role: 'ADMIN' } })
      if (!user) throw new NotFoundException('Usuário administrador do tenant não encontrado')
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } })
      return { email: user.email }
    })
    return { ok: true, message: 'Senha do administrador da clínica atualizada' }
  }

  async financeSummary() {
    const subscriptions = await this.master.subscription.findMany({ include: { tenant: true }, orderBy: { startedAt: 'desc' } })
    const activeStatuses: SubscriptionStatus[] = ['ACTIVE', 'TRIAL']
    const active = subscriptions.filter(item => activeStatuses.includes(item.status))
    const mrrCents = active.reduce((acc, item) => acc + item.priceCents, 0)
    const arrCents = mrrCents * 12
    const byPlan = {
      BASIC: subscriptions.filter(item => item.plan === 'BASIC').length,
      PRO: subscriptions.filter(item => item.plan === 'PRO').length
    }
    const byStatus = {
      PENDING: subscriptions.filter(item => item.status === 'PENDING').length,
      ACTIVE: subscriptions.filter(item => item.status === 'ACTIVE').length,
      TRIAL: subscriptions.filter(item => item.status === 'TRIAL').length,
      PAST_DUE: subscriptions.filter(item => item.status === 'PAST_DUE').length,
      CANCELED: subscriptions.filter(item => item.status === 'CANCELED').length
    }
    return {
      totals: {
        clinics: subscriptions.length,
        activeClinics: active.length,
        mrrCents,
        arrCents
      },
      byPlan,
      byStatus,
      recentSubscriptions: subscriptions.slice(0, 12).map(s => ({
        id: s.id,
        plan: s.plan,
        status: s.status,
        priceCents: s.priceCents,
        currency: s.currency,
        startedAt: s.startedAt,
        activatedAt: s.activatedAt,
        lastPaymentAt: s.lastPaymentAt,
        currentPeriodEnd: s.currentPeriodEnd,
        renewsAt: s.renewsAt,
        tenant: { id: s.tenant.id, name: s.tenant.name, subdomain: s.tenant.subdomain }
      }))
    }
  }

  async paymentEvents(tenantId?: string) {
    return this.billing.listPaymentEvents(tenantId)
  }
}
