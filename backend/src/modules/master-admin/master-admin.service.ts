import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { Prisma as TenantPrismaNamespace, PrismaClient as TenantPrisma, Role as TenantRole } from '@prisma/client-tenant'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { AccessGrant, Plan, SubscriptionStatus, Tenant } from '@prisma/client-master'
import { BillingService } from '../billing/billing.service'
import { AuthService } from '../auth/auth.service'
import { DENTIST_LIMIT_BY_PLAN } from '../billing/plan-limits'

type SanitizedTenant = Omit<Tenant, 'dbPassword'> & { dbPassword?: never }
type MasterUserRole = 'ADMIN' | 'USER' | 'DENTIST'

const MASTER_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { appointments: true, invoices: true } }
}

function usernameFromEmail(email: string) {
  return (email.split('@')[0] || 'usuario').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 32)
}

@Injectable()
export class MasterAdminService implements OnModuleInit {
  constructor(
    private readonly jwt: JwtService,
    private readonly master: MasterPrismaService,
    private readonly provision: TenantProvisionService,
    private readonly billing: BillingService,
    private readonly auth: AuthService
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

  private actorEmail() {
    return process.env.MASTER_SUPERADMIN_EMAIL?.trim() || 'master@odontoapp.local'
  }

  private activeGrant(grant: AccessGrant | null | undefined) {
    return grant?.active && (!grant.expiresAt || grant.expiresAt.getTime() > Date.now()) ? grant : null
  }

  private async audit(
    action: string,
    options: { tenantId?: string; targetType?: string; targetId?: string; metadata?: Record<string, unknown> } = {}
  ) {
    return this.master.masterAuditLog.create({
      data: {
        actorEmail: this.actorEmail(),
        action,
        tenantId: options.tenantId,
        targetType: options.targetType,
        targetId: options.targetId,
        metadata: options.metadata as any
      }
    })
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

  async login(email: string, password: string) {
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
    await this.audit('MASTER_LOGIN', { targetType: 'MASTER_ADMIN', targetId: masterEmail }).catch(() => undefined)
    return { accessToken, user: { email: masterEmail, name: 'Super Administrador', role: 'MASTER_ADMIN' } }
  }

  async listClinics() {
    const rows = await this.master.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
        accessGrant: true,
        loginIdentities: { select: { email: true } }
      }
    })
    return rows.map(r => ({
      ...this.sanitizeTenant(r),
      subscription: r.subscription,
      accessGrant: r.accessGrant,
      loginIdentities: r.loginIdentities
    }))
  }

  async getClinic(id: string) {
    const row = await this.master.tenant.findUnique({
      where: { id },
      include: {
        subscription: true,
        accessGrant: true,
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
      accessGrant: row.accessGrant,
      loginIdentities: row.loginIdentities,
      operations
    }
  }

  private async tenantOperationStats(t: Tenant) {
    return this.withTenantPrisma(t, async prisma => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart)
      todayEnd.setDate(todayEnd.getDate() + 1)
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const [
        patients,
        appointments,
        appointmentsToday,
        appointmentsLast30Days,
        users,
        activeUsers,
        usersByRole,
        records,
        files,
        invoiceAgg,
        invoicesCount,
        invoicesByStatus,
        paymentsAgg,
        expensesAgg,
        paidExpensesAgg,
        expensesCount,
        apptByStatus
      ] = await Promise.all([
        prisma.patient.count(),
        prisma.appointment.count(),
        prisma.appointment.count({ where: { startTime: { gte: todayStart, lt: todayEnd } } }),
        prisma.appointment.count({ where: { startTime: { gte: last30Days } } }),
        prisma.user.count(),
        prisma.user.count({ where: { active: true } }),
        prisma.user.groupBy({ by: ['role'], _count: { _all: true }, where: { active: true } }),
        prisma.record.count(),
        prisma.file.count(),
        prisma.invoice.aggregate({ _sum: { amount: true } }),
        prisma.invoice.count(),
        prisma.invoice.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true } }),
        prisma.invoicePayment.aggregate({ _sum: { amount: true } }),
        prisma.expense.aggregate({ _sum: { amount: true } }),
        prisma.expense.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
        prisma.expense.count(),
        prisma.appointment.groupBy({ by: ['status'], _count: { _all: true } })
      ])
      const invoiceTotal = invoiceAgg._sum.amount != null ? invoiceAgg._sum.amount.toString() : '0'
      return {
        patients,
        appointments,
        appointmentsToday,
        appointmentsLast30Days,
        users,
        activeUsers,
        inactiveUsers: Math.max(users - activeUsers, 0),
        usersByRole: usersByRole.map(x => ({ role: x.role, count: x._count._all })),
        records,
        files,
        invoicesCount,
        invoicesAmountSum: invoiceTotal,
        receivedAmountSum: paymentsAgg._sum.amount?.toString() || '0',
        expensesCount,
        expensesAmountSum: expensesAgg._sum.amount?.toString() || '0',
        paidExpensesAmountSum: paidExpensesAgg._sum.amount?.toString() || '0',
        invoicesByStatus: invoicesByStatus.map(x => ({
          status: x.status,
          count: x._count._all,
          amount: x._sum.amount?.toString() || '0'
        })),
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
      appointmentsToday: 0,
      appointmentsLast30Days: 0,
      users: 0,
      activeUsers: 0,
      records: 0,
      files: 0,
      invoicesCount: 0,
      expensesCount: 0
    }
    let invoiceDecimalSum = 0
    let receivedDecimalSum = 0
    let expenseDecimalSum = 0
    for (const t of tenants) {
      try {
        const stats = await this.tenantOperationStats(t)
        clinics.push({ tenantId: t.id, name: t.name, subdomain: t.subdomain, stats })
        totals.patients += stats.patients
        totals.appointments += stats.appointments
        totals.appointmentsToday += stats.appointmentsToday
        totals.appointmentsLast30Days += stats.appointmentsLast30Days
        totals.users += stats.users
        totals.activeUsers += stats.activeUsers
        totals.records += stats.records
        totals.files += stats.files
        totals.invoicesCount += stats.invoicesCount
        totals.expensesCount += stats.expensesCount
        invoiceDecimalSum += Number(stats.invoicesAmountSum || 0)
        receivedDecimalSum += Number(stats.receivedAmountSum || 0)
        expenseDecimalSum += Number(stats.expensesAmountSum || 0)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Falha na leitura'
        clinics.push({ tenantId: t.id, name: t.name, subdomain: t.subdomain, stats: null, error: message })
      }
    }
    return {
      totals: {
        ...totals,
        invoicesAmountSum: invoiceDecimalSum.toFixed(2),
        receivedAmountSum: receivedDecimalSum.toFixed(2),
        expensesAmountSum: expenseDecimalSum.toFixed(2)
      },
      clinics
    }
  }

  async financeClinics() {
    const subs = await this.master.subscription.findMany({
      include: { tenant: { include: { accessGrant: true } } },
      orderBy: { startedAt: 'desc' }
    })
    const activeStatuses: SubscriptionStatus[] = ['ACTIVE', 'TRIAL']
    return subs.map(s => {
      const t = s.tenant
      const accessGrant = this.activeGrant(t.accessGrant)
      return {
        id: s.id,
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
        accessGrant,
        effectivePlan: accessGrant?.plan || s.plan,
        countsForMrr: activeStatuses.includes(s.status) && !accessGrant
      }
    })
  }

  async createClinic(data: { name: string; subdomain?: string; adminEmail: string; adminPassword: string; plan: Plan; priceCents: number }) {
    const adminEmail = data.adminEmail.trim().toLowerCase()
    const existingIdentity = await this.master.loginIdentity.findUnique({ where: { email: adminEmail } })
    if (existingIdentity) throw new ConflictException('Este e-mail já pertence a uma clínica cadastrada.')
    const provisioned = await this.provision.provision({
      name: data.name,
      subdomain: data.subdomain,
      adminEmail,
      adminPassword: data.adminPassword
    })
    const tenant = await this.master.tenant.findUnique({ where: { slug: provisioned.slug } })
    if (!tenant) throw new Error('Falha ao localizar clínica provisionada')
    await this.master.loginIdentity.upsert({
      where: { email: adminEmail },
      update: { tenantId: tenant.id },
      create: { email: adminEmail, tenantId: tenant.id }
    })
    const subscription = await this.master.subscription.upsert({
      where: { tenantId: tenant.id },
      update: { plan: data.plan, priceCents: data.priceCents, status: 'ACTIVE' },
      create: { tenantId: tenant.id, plan: data.plan, priceCents: data.priceCents, status: 'ACTIVE' }
    })
    await this.audit('CLINIC_CREATED', {
      tenantId: tenant.id,
      targetType: 'TENANT',
      targetId: tenant.id,
      metadata: { name: tenant.name, plan: data.plan, priceCents: data.priceCents, adminEmail }
    })
    return { tenant: this.sanitizeTenant(tenant), subscription }
  }

  async updateClinic(
    id: string,
    data: {
      name?: string
      subdomain?: string
      internalNotes?: string | null
      primaryColor?: string
      logoUrl?: string
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

    const tenantData: { name?: string; subdomain?: string; internalNotes?: string | null; primaryColor?: string | null; logoUrl?: string | null } = {}
    if (data.name !== undefined) tenantData.name = data.name
    if (data.subdomain !== undefined && data.subdomain !== '') tenantData.subdomain = data.subdomain
    if (data.internalNotes !== undefined) tenantData.internalNotes = data.internalNotes
    if (data.primaryColor !== undefined) tenantData.primaryColor = data.primaryColor.trim() || null
    if (data.logoUrl !== undefined) tenantData.logoUrl = data.logoUrl.trim() || null

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

    await this.audit('CLINIC_UPDATED', {
      tenantId: id,
      targetType: 'TENANT',
      targetId: id,
      metadata: {
        fields: Object.keys(data),
        plan: data.plan,
        status: data.status,
        priceCents: data.priceCents
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
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } }),
        prisma.refreshToken.deleteMany({ where: { userId: user.id } })
      ])
      return { email: user.email }
    })
    await this.audit('TENANT_ADMIN_PASSWORD_RESET', {
      tenantId,
      targetType: 'USER',
      metadata: { adminEmail: adminEmail || null }
    })
    return { ok: true, message: 'Senha do administrador da clínica atualizada' }
  }

  private async tenantOrThrow(tenantId: string) {
    const tenant = await this.master.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new NotFoundException('Clínica não encontrada')
    return tenant
  }

  private async assertLoginIdentityAvailable(email: string, tenantId: string) {
    const identity = await this.master.loginIdentity.findUnique({ where: { email } })
    if (identity && identity.tenantId !== tenantId) {
      throw new ConflictException('Este e-mail já pertence a um usuário de outra clínica.')
    }
  }

  private async assertDentistSlotAvailable(tenant: Tenant, tenantId: string) {
    const commercial = await this.master.subscription.findUnique({ where: { tenantId }, select: { plan: true } })
    const storedGrant = await this.master.accessGrant.findUnique({ where: { tenantId } })
    const grant = this.activeGrant(storedGrant)
    const plan = grant?.plan ?? commercial?.plan ?? 'FREE'
    const limit = grant ? grant.dentistLimit : DENTIST_LIMIT_BY_PLAN[plan]
    if (limit === null) return
    const used = await this.withTenantPrisma(tenant, prisma => prisma.user.count({ where: { role: 'DENTIST' } }))
    if (used >= limit) {
      throw new ConflictException(`O plano efetivo permite ${limit} dentista${limit === 1 ? '' : 's'}. Ajuste o benefício ou o plano antes de adicionar outro.`)
    }
  }

  async listTenantUsers(tenantId: string) {
    const tenant = await this.tenantOrThrow(tenantId)
    return this.withTenantPrisma(tenant, prisma =>
      prisma.user.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'asc' }], select: MASTER_USER_SELECT })
    )
  }

  async createTenantUser(
    tenantId: string,
    data: { username?: string; email: string; name: string; password: string; role: MasterUserRole; active?: boolean }
  ) {
    const tenant = await this.tenantOrThrow(tenantId)
    const email = data.email.trim().toLowerCase()
    await this.assertLoginIdentityAvailable(email, tenantId)
    if (data.role === 'DENTIST') await this.assertDentistSlotAvailable(tenant, tenantId)
    const passwordHash = await argon2.hash(data.password)
    try {
      const user = await this.withTenantPrisma(tenant, prisma =>
        prisma.user.create({
          data: {
            username: (data.username?.trim() || usernameFromEmail(email)).slice(0, 32),
            email,
            name: data.name.trim(),
            passwordHash,
            role: data.role as TenantRole,
            active: data.active !== false
          },
          select: MASTER_USER_SELECT
        })
      )
      await this.master.loginIdentity.upsert({
        where: { email },
        update: { tenantId },
        create: { email, tenantId }
      })
      await this.audit('TENANT_USER_CREATED', {
        tenantId,
        targetType: 'USER',
        targetId: user.id,
        metadata: { email: user.email, role: user.role, active: user.active }
      })
      return user
    } catch (error) {
      if (error instanceof TenantPrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('E-mail ou nome de usuário já cadastrado nesta clínica.')
      }
      throw error
    }
  }

  async updateTenantUser(
    tenantId: string,
    userId: string,
    data: { username?: string | null; email?: string; name?: string; password?: string; role?: MasterUserRole; active?: boolean }
  ) {
    const tenant = await this.tenantOrThrow(tenantId)
    const existing = await this.withTenantPrisma(tenant, prisma => prisma.user.findUnique({ where: { id: userId } }))
    if (!existing) throw new NotFoundException('Usuário não encontrado')

    const removesActiveAdmin =
      existing.role === 'ADMIN' && ((data.role !== undefined && data.role !== 'ADMIN') || data.active === false)
    if (removesActiveAdmin && existing.active) {
      const activeAdmins = await this.withTenantPrisma(tenant, prisma =>
        prisma.user.count({ where: { role: 'ADMIN', active: true } })
      )
      if (activeAdmins <= 1) {
        throw new BadRequestException('Crie ou ative outro administrador antes de desativar o último ADMIN da clínica.')
      }
    }
    if (existing.role !== 'DENTIST' && data.role === 'DENTIST') {
      await this.assertDentistSlotAvailable(tenant, tenantId)
    }

    const patch: Record<string, unknown> = {}
    if (data.username !== undefined) patch.username = data.username?.trim() || null
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.role !== undefined) patch.role = data.role as TenantRole
    if (data.active !== undefined) patch.active = data.active
    const email = data.email?.trim().toLowerCase()
    if (email !== undefined) {
      await this.assertLoginIdentityAvailable(email, tenantId)
      patch.email = email
    }
    if (data.password) patch.passwordHash = await argon2.hash(data.password)
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nenhuma alteração informada.')

    try {
      const user = await this.withTenantPrisma(tenant, async prisma => {
        const updated = await prisma.user.update({ where: { id: userId }, data: patch, select: MASTER_USER_SELECT })
        if (data.password || data.role !== undefined || data.active !== undefined) {
          await prisma.refreshToken.deleteMany({ where: { userId } })
        }
        return updated
      })
      if (email && email !== existing.email) {
        await this.master.$transaction([
          this.master.loginIdentity.deleteMany({ where: { email: existing.email, tenantId } }),
          this.master.loginIdentity.upsert({ where: { email }, update: { tenantId }, create: { email, tenantId } })
        ])
      }
      await this.audit('TENANT_USER_UPDATED', {
        tenantId,
        targetType: 'USER',
        targetId: userId,
        metadata: { fields: Object.keys(data), email: user.email, role: user.role, active: user.active }
      })
      return user
    } catch (error) {
      if (error instanceof TenantPrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('E-mail ou nome de usuário já cadastrado nesta clínica.')
      }
      throw error
    }
  }

  async createSupportSession(tenantId: string, userId?: string) {
    const tenant = await this.tenantOrThrow(tenantId)
    const session = await this.auth.issueMasterSupportSession(this.tenantDbUrl(tenant), userId)
    await this.audit('SUPPORT_SESSION_CREATED', {
      tenantId,
      targetType: 'USER',
      targetId: session.user.id,
      metadata: { email: session.user.email, role: session.user.role }
    })
    return { ...session, tenant: tenant.subdomain, clinic: { id: tenant.id, name: tenant.name } }
  }

  async grantAccess(
    tenantId: string,
    data: { plan: Plan; dentistLimit?: number | null; reason?: string; expiresAt?: string | null; stopBilling?: boolean }
  ) {
    await this.tenantOrThrow(tenantId)
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) {
      throw new BadRequestException('A validade do benefício deve estar no futuro.')
    }
    const stopBilling = data.stopBilling !== false
    const subscription = stopBilling
      ? await this.master.subscription.findUnique({ where: { tenantId }, select: { id: true } })
      : null
    const billingResult = stopBilling && subscription
      ? await this.billing.cancelTenantSubscription(tenantId)
      : stopBilling
        ? { ok: true, message: 'Nenhuma cobrança comercial existente.' }
        : null
    const dentistLimit = data.dentistLimit !== undefined ? data.dentistLimit : DENTIST_LIMIT_BY_PLAN[data.plan]
    const grant = await this.master.accessGrant.upsert({
      where: { tenantId },
      update: {
        plan: data.plan,
        dentistLimit,
        reason: data.reason?.trim() || null,
        expiresAt,
        active: true,
        stopBilling,
        createdBy: this.actorEmail(),
        revokedAt: null
      },
      create: {
        tenantId,
        plan: data.plan,
        dentistLimit,
        reason: data.reason?.trim() || null,
        expiresAt,
        active: true,
        stopBilling,
        createdBy: this.actorEmail()
      }
    })
    await this.audit('ACCESS_GRANT_CREATED', {
      tenantId,
      targetType: 'ACCESS_GRANT',
      targetId: grant.id,
      metadata: { plan: grant.plan, dentistLimit: grant.dentistLimit, expiresAt, stopBilling, reason: grant.reason }
    })
    return { grant, billing: billingResult }
  }

  async revokeAccess(tenantId: string) {
    await this.tenantOrThrow(tenantId)
    const existing = await this.master.accessGrant.findUnique({ where: { tenantId } })
    if (!existing) throw new NotFoundException('Benefício não encontrado.')
    const grant = await this.master.accessGrant.update({
      where: { tenantId },
      data: { active: false, revokedAt: new Date() }
    })
    await this.audit('ACCESS_GRANT_REVOKED', {
      tenantId,
      targetType: 'ACCESS_GRANT',
      targetId: grant.id,
      metadata: { plan: grant.plan, reason: grant.reason }
    })
    return { ok: true, grant }
  }

  async auditLogs(filters: { tenantId?: string; action?: string; take?: number }) {
    const take = Math.min(Math.max(filters.take || 100, 1), 300)
    const rows = await this.master.masterAuditLog.findMany({
      where: {
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.action ? { action: { contains: filters.action, mode: 'insensitive' as const } } : {})
      },
      orderBy: { createdAt: 'desc' },
      take
    })
    const tenantIds = [...new Set(rows.map(row => row.tenantId).filter((id): id is string => Boolean(id)))]
    const tenants = tenantIds.length
      ? await this.master.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })
      : []
    const names = new Map(tenants.map(item => [item.id, item.name]))
    return rows.map(row => ({ ...row, tenantName: row.tenantId ? names.get(row.tenantId) || null : null }))
  }

  async financeSummary() {
    const subscriptions = await this.master.subscription.findMany({
      include: { tenant: { include: { accessGrant: true } } },
      orderBy: { startedAt: 'desc' }
    })
    const activeStatuses: SubscriptionStatus[] = ['ACTIVE', 'TRIAL']
    const active = subscriptions.filter(item => activeStatuses.includes(item.status) || Boolean(this.activeGrant(item.tenant.accessGrant)))
    const complimentary = subscriptions.filter(item => Boolean(this.activeGrant(item.tenant.accessGrant)))
    const mrrCents = active.reduce((acc, item) => acc + (this.activeGrant(item.tenant.accessGrant) ? 0 : item.priceCents), 0)
    const arrCents = mrrCents * 12
    const byPlan = {
      FREE: subscriptions.filter(item => item.plan === 'FREE').length,
      BASIC: subscriptions.filter(item => item.plan === 'BASIC').length,
      PRO: subscriptions.filter(item => item.plan === 'PRO').length,
      CLINIC: subscriptions.filter(item => item.plan === 'CLINIC').length
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
        complimentaryClinics: complimentary.length,
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
        accessGrant: this.activeGrant(s.tenant.accessGrant),
        tenant: { id: s.tenant.id, name: s.tenant.name, subdomain: s.tenant.subdomain }
      }))
    }
  }

  async paymentEvents(tenantId?: string) {
    return this.billing.listPaymentEvents(tenantId)
  }
}
