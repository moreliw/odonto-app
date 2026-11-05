import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common'
import { Prisma, Plan, SignupIntent, SubscriptionStatus, BillingInterval } from '@prisma/client-master'
import Stripe = require('stripe')
import * as argon2 from 'argon2'
import { randomUUID } from 'crypto'
import { withBillingLock } from './billing-lock'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { MailerService } from '../mailer/mailer.service'
import { AuthService } from '../auth/auth.service'
import { DENTIST_LIMIT_BY_PLAN, PLAN_LABEL } from './plan-limits'

type CheckoutRequest = {
  clinicName: string
  adminName?: string
  requestedSubdomain?: string
  adminEmail: string
  adminPassword: string
  plan: Plan
  billingInterval?: BillingInterval
  requestId?: string
}

type PlanPublicInfo = {
  code: Plan
  name: string
  priceCents: number
  /** Total cobrado uma vez por ano no ciclo anual (10% de desconto sobre 12x o mensal). 0 para o plano FREE. */
  annualPriceCents: number
  currency: string
  description: string
  features: string[]
}

/** Mesmo desconto e arredondamento usados na landing (frontend/src/app/config/landing.config.ts `annualPrice()`) — precisa continuar espelhando esse cálculo. */
const ANNUAL_DISCOUNT = 0.1
function annualTotalCents(monthlyCents: number) {
  const discountedMonthly = Math.floor((monthlyCents * (1 - ANNUAL_DISCOUNT)) / 10) * 10
  return discountedMonthly * 12
}

type StripeEvent = any
type StripeCheckoutSession = any
type StripeInvoice = any
type StripeSubscription = any

/**
 * Planos vendáveis hoje. Os priceCents precisam bater com o valor dos price IDs
 * configurados no Stripe (STRIPE_PRICE_*_MONTHLY), senão o cliente vê um preço
 * na landing e é cobrado outro no checkout.
 *
 * Em produção, cada plano precisa de um Price ID fixo e validado. Assim a
 * aplicação recusa o checkout se o valor configurado divergir do catálogo.
 */
export const PLAN_CATALOG: Partial<Record<Plan, PlanPublicInfo>> = {
  FREE: {
    code: 'FREE',
    name: 'Teste Gratuito',
    priceCents: 0,
    annualPriceCents: 0,
    currency: 'BRL',
    description: 'Uso interno para testar o fluxo completo de assinatura, sem cobrança.',
    features: ['Todos os módulos liberados', 'Acesso completo por 7 dias', 'Ativação imediata']
  },
  BASIC: {
    code: 'BASIC',
    name: 'Essencial',
    priceCents: 12900,
    annualPriceCents: annualTotalCents(12900),
    currency: 'BRL',
    description: 'Para profissionais autônomos e consultórios menores.',
    features: ['Agenda e pacientes', 'Prontuário digital', 'Financeiro básico', 'Suporte por e-mail']
  },
  PRO: {
    code: 'PRO',
    name: 'Profissional',
    priceCents: 27900,
    annualPriceCents: annualTotalCents(27900),
    currency: 'BRL',
    description: 'Para consultórios e clínicas que trabalham com equipe.',
    features: ['Tudo do Essencial', 'Até 3 dentistas', 'Perfis de acesso', 'Suporte prioritário']
  },
  CLINIC: {
    code: 'CLINIC',
    name: 'Clínica',
    priceCents: 44900,
    annualPriceCents: annualTotalCents(44900),
    currency: 'BRL',
    description: 'Para clínicas com vários profissionais e volume alto de atendimento.',
    features: ['Tudo do Profissional', 'Dentistas ilimitados', 'Armazenamento ampliado', 'Atendimento prioritário']
  }
}

/** Texto curto do limite de dentistas, exibido no card do plano. */
function dentistLimitLabel(limit: number | null) {
  if (limit === null) return 'Dentistas ilimitados'
  return limit === 1 ? '1 dentista' : `Até ${limit} dentistas`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function normalizeSubdomain(value: string) {
  return slugify(value).replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')
}

function asIsoOrNull(ts: number | null | undefined) {
  if (!ts) return null
  return new Date(ts * 1000)
}

function readableSubscriptionStatus(status: SubscriptionStatus) {
  if (status === 'ACTIVE') return 'ativa'
  if (status === 'TRIAL') return 'em trial'
  if (status === 'PAST_DUE') return 'em atraso'
  if (status === 'CANCELED') return 'cancelada'
  return 'pendente'
}

@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name)
  private stripeClient: Stripe.Stripe | null | undefined
  private readonly priceIdCache = new Map<string, Promise<string>>()

  constructor(
    private readonly master: MasterPrismaService,
    private readonly provision: TenantProvisionService,
    private readonly mailer: MailerService,
    private readonly auth: AuthService
  ) {}

  /** Catálogo exibido no cadastro público, já com o limite de dentistas — é o que diferencia um plano do outro. */
  getPublicPlans() {
    return Object.values(PLAN_CATALOG)
      .filter(plan => plan.code !== 'FREE' || this.freeSignupsEnabled())
      .map(plan => ({
        ...plan,
        trialDays: this.trialDays(),
        monthlyAvailable: this.priceAvailable(plan.code, 'MONTH'),
        annualAvailable: this.priceAvailable(plan.code, 'YEAR'),
        dentistLimit: DENTIST_LIMIT_BY_PLAN[plan.code],
        limitLabel: dentistLimitLabel(DENTIST_LIMIT_BY_PLAN[plan.code])
      }))
  }

  private priceAvailable(plan: Plan, interval: BillingInterval) {
    return plan === 'FREE' || !this.stripeKeyIsLive() || Boolean(this.configuredPriceId(plan, interval))
  }

  private freeSignupsEnabled() {
    return process.env.ALLOW_FREE_SIGNUP === 'true'
  }

  private trialDays() {
    const parsed = Number(process.env.STRIPE_TRIAL_DAYS || '7')
    return Number.isFinite(parsed) ? Math.max(0, Math.min(365, Math.trunc(parsed))) : 7
  }

  private stripeKeyIsLive() {
    return process.env.STRIPE_SECRET_KEY?.trim().startsWith('sk_live_') ?? false
  }

  private getStripeClient() {
    if (this.stripeClient !== undefined) return this.stripeClient
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
    if (!secretKey) {
      this.log.error('STRIPE_SECRET_KEY nao configurada no backend')
      this.stripeClient = null
      return this.stripeClient
    }
    const expectedLivemode = process.env.STRIPE_EXPECTED_LIVEMODE?.trim()
    const keyIsLive = secretKey.startsWith('sk_live_')
    if (expectedLivemode && keyIsLive !== (expectedLivemode === 'true')) {
      this.log.error('STRIPE_SECRET_KEY pertence a um ambiente diferente de STRIPE_EXPECTED_LIVEMODE')
      this.stripeClient = null
      return this.stripeClient
    }
    this.stripeClient = new Stripe(secretKey, { timeout: 15000, maxNetworkRetries: 0 })
    return this.stripeClient
  }

  private getAppBaseUrl() {
    const explicit = process.env.PUBLIC_APP_URL?.trim()
    if (explicit) return explicit.replace(/\/+$/, '')
    const publicDomain = process.env.PUBLIC_DOMAIN?.trim()
    if (publicDomain) return `https://${publicDomain}`.replace(/\/+$/, '')
    return 'http://localhost:4200'
  }

  private toInternalSubscriptionStatus(status: string): SubscriptionStatus {
    switch (status) {
      case 'active':
        return 'ACTIVE'
      case 'trialing':
        return 'TRIAL'
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
      case 'paused':
        return 'PAST_DUE'
      case 'canceled':
      case 'incomplete_expired':
        return 'CANCELED'
      default:
        return 'PENDING'
    }
  }

  private stripeSubscriptionPeriodEnd(subscription: StripeSubscription | null | undefined) {
    if (!subscription) return null
    const topLevel = subscription.current_period_end
    const itemLevel = subscription.items?.data?.[0]?.current_period_end
    return asIsoOrNull(topLevel || itemLevel || subscription.trial_end)
  }

  private planFromStripeSubscription(subscription: StripeSubscription): Plan | null {
    const price = subscription.items?.data?.[0]?.price
    if (!price) return null
    const priceId = typeof price === 'string' ? price : price.id
    for (const code of ['BASIC', 'PRO', 'CLINIC'] as Plan[]) {
      if (this.configuredPriceId(code, 'MONTH') === priceId) return code
      if (this.configuredPriceId(code, 'YEAR') === priceId) return code
    }

    const metadataPlan = typeof price === 'string' ? null : price.metadata?.plan
    if (metadataPlan && PLAN_CATALOG[metadataPlan as Plan]) return metadataPlan as Plan

    if (typeof price !== 'string') {
      const interval = price.recurring?.interval
      const byAmount = Object.values(PLAN_CATALOG).find(plan => {
        if (plan.code === 'FREE' || price.currency !== plan.currency.toLowerCase()) return false
        if (interval === 'month') return price.unit_amount === plan.priceCents
        if (interval === 'year') return price.unit_amount === plan.annualPriceCents
        return false
      })
      return byAmount?.code || null
    }
    return null
  }

  private billingIntervalFromStripe(subscription: StripeSubscription | null | undefined): BillingInterval {
    const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval
    return interval === 'year' ? 'YEAR' : 'MONTH'
  }

  private async retrieveStripeSubscription(id: string | null | undefined) {
    if (!id) return null
    const stripe = this.getStripeClient()
    if (!stripe) return null
    return stripe.subscriptions.retrieve(id)
  }

  private expandableId(value: unknown) {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id)
    return null
  }

  private invoiceSubscriptionId(invoice: StripeInvoice) {
    const direct = this.expandableId(invoice?.subscription)
    if (direct) return direct
    return this.expandableId(invoice?.parent?.subscription_details?.subscription)
  }

  private async isSubdomainAvailable(subdomain: string) {
    const [tenant, intent] = await Promise.all([
      this.master.tenant.findUnique({ where: { subdomain } }),
      this.master.signupIntent.findFirst({
        where: {
          requestedSubdomain: subdomain,
          status: { in: ['PENDING', 'PROCESSING', 'PROVISIONED'] }
        }
      })
    ])
    return !tenant && !intent
  }

  private async resolveSubdomain(rawClinicName: string, requestedSubdomain?: string) {
    if (requestedSubdomain) {
      const normalized = normalizeSubdomain(requestedSubdomain)
      if (!normalized || normalized.length < 3) {
        throw new BadRequestException('Subdomínio inválido. Use ao menos 3 caracteres.')
      }
      const available = await this.isSubdomainAvailable(normalized)
      if (!available) throw new ConflictException('Subdomínio já está em uso.')
      return normalized
    }

    const normalizedName = normalizeSubdomain(rawClinicName).slice(0, 35).replace(/-+$/g, '')
    const seed = normalizedName.length >= 3 ? normalizedName : `clinica-${randomUUID().slice(0, 8)}`
    if (await this.isSubdomainAvailable(seed)) return seed

    for (let i = 2; i <= 200; i++) {
      const candidate = `${seed}-${i}`
      if (await this.isSubdomainAvailable(candidate)) return candidate
    }
    throw new ConflictException('Não foi possível gerar um subdomínio disponível. Tente definir manualmente.')
  }

  async createCheckoutSession(input: CheckoutRequest) {
    // Serializes duplicate submissions (including retries after a lost response)
    // across backend instances, without relying on an in-memory mutex.
    return withBillingLock(`signup:${input.adminEmail.trim().toLowerCase()}`, () => this.createCheckoutSessionLocked(input))
  }

  private async createCheckoutSessionLocked(input: CheckoutRequest) {
    const plan = PLAN_CATALOG[input.plan]
    if (plan?.code === 'FREE' && !this.freeSignupsEnabled()) {
      throw new BadRequestException('O plano gratuito é restrito ao ambiente interno de testes.')
    }
    if (!plan) throw new BadRequestException('Plano inválido.')

    const clinicName = input.clinicName.trim()
    if (clinicName.length < 3) {
      throw new BadRequestException({
        message: 'Informe o nome da clínica.',
        errors: { clinicName: 'Informe o nome da clínica.' }
      })
    }
    const adminEmail = input.adminEmail.trim().toLowerCase()
    const adminPassword = input.adminPassword
    if (adminPassword.length < 8) {
      throw new BadRequestException({
        message: 'A senha deve ter no mínimo 8 caracteres.',
        errors: { adminPassword: 'A senha deve ter no mínimo 8 caracteres.' }
      })
    }

    const existingIdentity = await this.master.loginIdentity.findUnique({ where: { email: adminEmail } })
    if (existingIdentity) {
      // `errors` permite o formulário destacar exatamente o campo do e-mail em vez de só mostrar um alerta solto.
      throw new ConflictException({
        message: 'Este e-mail já está vinculado a uma clínica. Faça login para continuar.',
        errors: { adminEmail: 'Este e-mail já está vinculado a uma clínica.' }
      })
    }

    const requestedSubdomain = await this.resolveSubdomain(clinicName, input.requestedSubdomain)
    const clinicSlug = slugify(clinicName)
    const adminPasswordHash = await argon2.hash(adminPassword)
    const billingInterval: BillingInterval = input.billingInterval === 'YEAR' ? 'YEAR' : 'MONTH'
    const priceCentsForRecord = billingInterval === 'YEAR' ? plan.annualPriceCents : plan.priceCents

    // Only the same request and password can resume its checkout. A cancelled
    // browser visit can submit again without creating duplicate subscriptions.
    if (input.requestId) {
      const previous = await this.master.signupIntent.findFirst({ where: { adminEmail, metadata: { path: ['requestId'], equals: input.requestId } }, orderBy: { createdAt: 'desc' } })
      if (previous && await argon2.verify(previous.adminPasswordHash, adminPassword)) {
        if (previous.status === 'PROVISIONED') return { intentId: previous.id, checkoutUrl: `${this.getAppBaseUrl()}/signup/success?session_id=${previous.providerSessionId}`, sessionId: previous.providerSessionId, expiresAt: null, plan }
        if (previous.checkoutUrl && previous.checkoutExpiresAt && previous.checkoutExpiresAt > new Date() && previous.clinicName === clinicName && previous.plan === input.plan && (previous.metadata as any)?.billingInterval === billingInterval && ['PENDING', 'PROCESSING'].includes(previous.status)) {
          return { intentId: previous.id, checkoutUrl: previous.checkoutUrl, sessionId: previous.providerSessionId, expiresAt: previous.checkoutExpiresAt, plan }
        }
      }
    }

    const stripe = plan.priceCents > 0 ? this.getStripeClient() : null
    if (plan.priceCents > 0 && !stripe) throw new ServiceUnavailableException('Pagamentos temporariamente indisponíveis.')
    // Validate configuration before reserving an address. A missing price must
    // not leave the customer with an unusable signup reservation.
    const priceId = stripe ? await this.resolvePriceId(stripe, plan, billingInterval) : null

    if (stripe) {
      const pending = await this.master.signupIntent.findMany({ where: { adminEmail, status: { in: ['PENDING', 'PROCESSING'] }, providerSessionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 20 })
      for (const previous of pending) {
        const session = await stripe.checkout.sessions.retrieve(previous.providerSessionId!)
        if (session.status === 'complete') {
          await this.onCheckoutSessionPaid(session)
          throw new ConflictException('Seu cadastro anterior já foi confirmado. Entre na sua conta para continuar; não é necessário assinar novamente.')
        }
        if (session.status === 'open' && session.url && previous.clinicName === clinicName && previous.plan === input.plan && (previous.metadata as any)?.billingInterval === billingInterval && await argon2.verify(previous.adminPasswordHash, adminPassword)) {
          return { intentId: previous.id, checkoutUrl: session.url, sessionId: session.id, expiresAt: asIsoOrNull(session.expires_at), plan }
        }
        if (session.status === 'open') await stripe.checkout.sessions.expire(session.id)
        await this.master.signupIntent.update({ where: { id: previous.id }, data: { status: 'CANCELED', failedReason: 'Substituído por uma nova tentativa de cadastro.' } })
      }
    }

    const intent = await this.master.signupIntent.create({
      data: {
        clinicName,
        clinicSlug,
        requestedSubdomain,
        adminName: input.adminName?.trim() || null,
        adminEmail,
        adminPasswordHash,
        plan: plan.code,
        priceCents: priceCentsForRecord,
        currency: plan.currency,
        status: 'PENDING',
        metadata: {
          source: 'landing',
          ipHint: 'web',
          billingInterval,
          requestId: input.requestId || randomUUID()
        }
      }
    })

    if (plan.priceCents === 0) {
      return this.activateFreeSignup(intent, plan)
    }

    if (!stripe) throw new ServiceUnavailableException('Pagamentos temporariamente indisponíveis.')

    const successUrl = `${this.getAppBaseUrl()}/signup/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${this.getAppBaseUrl()}/signup?canceled=1&plan=${plan.code}&cycle=${billingInterval === 'YEAR' ? 'annual' : 'monthly'}`
    const trialDays = this.trialDays()

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        client_reference_id: intent.id,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: adminEmail,
        locale: 'pt-BR',
        payment_method_collection: trialDays > 0 ? 'if_required' : 'always',
        metadata: {
          intentId: intent.id,
          clinicSlug: clinicSlug.slice(0, 40),
          plan: plan.code,
          billingInterval
        },
        subscription_data: {
          ...(trialDays > 0
            ? {
                trial_period_days: trialDays,
                trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } }
              }
            : {}),
          metadata: {
            intentId: intent.id,
            clinicSlug: clinicSlug.slice(0, 40),
            plan: plan.code,
            billingInterval
          }
        },
        line_items: [{ price: priceId!, quantity: 1 }]
      }, { timeout: 15000, maxNetworkRetries: 1, idempotencyKey: `signup-${intent.id}` })

      await this.master.signupIntent.update({
        where: { id: intent.id },
        data: {
          providerSessionId: session.id,
          providerCustomerId: typeof session.customer === 'string' ? session.customer : null,
          providerSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
          checkoutUrl: session.url || null,
          checkoutExpiresAt: asIsoOrNull(session.expires_at)
        }
      })

      if (!session.url) throw new ServiceUnavailableException('Falha ao gerar link de pagamento.')
      return {
        intentId: intent.id,
        checkoutUrl: session.url,
        sessionId: session.id,
        expiresAt: asIsoOrNull(session.expires_at),
        plan
      }
    } catch (error) {
      await this.master.signupIntent.update({
        where: { id: intent.id },
        data: {
          status: 'FAILED',
          failedReason: error instanceof Error ? error.message : 'Checkout creation failed'
        }
      })
      this.log.error({ err: error }, 'stripe checkout session creation failed')
      const maybeStripeType =
        error && typeof error === 'object' && 'type' in error
          ? String((error as any).type || '')
          : ''
      const isConnectionLike =
        maybeStripeType.toLowerCase().includes('connection') ||
        (error instanceof Error && /timeout|network|ECONN|ETIMEDOUT|socket/i.test(error.message))
      if (isConnectionLike) {
        throw new ServiceUnavailableException('Gateway de pagamento indisponivel no momento. Tente novamente em instantes.')
      }
      throw new ServiceUnavailableException('Nao foi possivel iniciar o pagamento agora. Tente novamente.')
    }
  }

  /** Ativa clínicas do plano gratuito de teste sem passar pelo Stripe. */
  private async activateFreeSignup(intent: SignupIntent, plan: PlanPublicInfo) {
    const sessionId = `free-${intent.id}`

    await this.master.signupIntent.update({
      where: { id: intent.id },
      data: { providerSessionId: sessionId, status: 'PROCESSING', paidAt: new Date() }
    })

    try {
      const provisioned = await this.provision.provision({
        name: intent.clinicName,
        subdomain: intent.requestedSubdomain,
        adminEmail: intent.adminEmail,
        adminPasswordHash: intent.adminPasswordHash,
        adminName: intent.adminName || undefined
      })

      const tenant = await this.master.tenant.findUnique({ where: { slug: provisioned.slug } })
      if (!tenant) throw new Error('Tenant provisionado não encontrado no master.')

      await this.master.loginIdentity.upsert({
        where: { email: intent.adminEmail },
        update: { tenantId: tenant.id },
        create: { email: intent.adminEmail, tenantId: tenant.id }
      })

      const now = new Date()
      await this.master.subscription.upsert({
        where: { tenantId: tenant.id },
        update: {
          plan: intent.plan,
          status: 'ACTIVE',
          priceCents: 0,
          currency: intent.currency,
          provider: null,
          providerCustomerId: null,
          providerSubscriptionId: null,
          activatedAt: now,
          lastPaymentAt: now,
          currentPeriodEnd: null,
          renewsAt: null,
          canceledAt: null,
          cancelAtPeriodEnd: false
        },
        create: {
          tenantId: tenant.id,
          plan: intent.plan,
          status: 'ACTIVE',
          priceCents: 0,
          currency: intent.currency,
          startedAt: now,
          activatedAt: now,
          lastPaymentAt: now
        }
      })

      await this.master.signupIntent.update({
        where: { id: intent.id },
        data: { status: 'PROVISIONED', activatedAt: now, tenantId: tenant.id }
      })

      await this.sendWelcomeEmail({
        to: intent.adminEmail,
        adminName: intent.adminName || 'Administrador',
        clinicName: intent.clinicName,
        subdomain: tenant.subdomain
      })
    } catch (error) {
      await this.master.signupIntent.update({
        where: { id: intent.id },
        data: {
          status: 'FAILED',
          failedReason: error instanceof Error ? error.message : 'Free signup activation failed'
        }
      })
      this.log.error({ err: error }, 'free signup activation failed')
      throw new ServiceUnavailableException('Não foi possível ativar a clínica de teste agora. Tente novamente.')
    }

    return {
      intentId: intent.id,
      checkoutUrl: `${this.getAppBaseUrl()}/signup/success?session_id=${sessionId}`,
      sessionId,
      expiresAt: null,
      plan
    }
  }

  async getCheckoutSessionStatus(sessionId: string) {
    let intent = await this.master.signupIntent.findFirst({
      where: { providerSessionId: sessionId },
      include: { tenant: { include: { subscription: true } } }
    })
    if (!intent) throw new NotFoundException('Sessão de checkout não encontrada.')

    const isFreeSession = intent.providerSessionId?.startsWith('free-') ?? false
    const stripe = isFreeSession ? null : this.getStripeClient()
    let stripeSession: StripeCheckoutSession | null = null
    let stripeSessionStatus: string | null = null
    let stripePaymentStatus: string | null = null

    if (stripe && intent.providerSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(intent.providerSessionId)
        stripeSession = session
        stripeSessionStatus = session.status || null
        stripePaymentStatus = session.payment_status || null
      } catch (error) {
        this.log.warn(`failed to read stripe session ${intent.providerSessionId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Resiliência ao atraso/erro de webhook: o retorno do Checkout também pode
    // concluir o provisionamento, sempre pela mesma rotina idempotente.
    if (
      stripeSession &&
      stripeSessionStatus === 'complete' &&
      ['paid', 'no_payment_required'].includes(stripePaymentStatus || '') &&
      intent.status !== 'PROVISIONED'
    ) {
      await this.onCheckoutSessionPaid(stripeSession)
      const refreshed = await this.master.signupIntent.findUnique({
        where: { id: intent.id },
        include: { tenant: { include: { subscription: true } } }
      })
      if (refreshed) intent = refreshed
    }

    const subscriptionStatus = intent.tenant?.subscription?.status || 'PENDING'
    const loginAllowed = subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIAL'

    // Login automático: a clínica acabou de ser criada, o usuário não deveria
    // digitar a senha de novo numa tela técnica de "status do onboarding".
    // Só emite token quando o tenant já está pronto para uso; falha aqui não
    // deve quebrar o polling — o frontend cai para a tela de login manual.
    let auth: { accessToken: string; refreshToken: string; user: { id: string; email: string; name: string; role: string } } | null = null
    if (loginAllowed && intent.tenant && intent.activatedAt && Date.now() - intent.activatedAt.getTime() <= 15 * 60_000) {
      try {
        const url = this.tenantConnectionUrl(intent.tenant.dbName, intent.tenant.slug)
        const issued = await this.auth.issueTokensForNewAccount(url, intent.adminEmail)
        auth = {
          accessToken: issued.accessToken,
          refreshToken: issued.refreshToken,
          user: { id: issued.user.id, email: issued.user.email, name: issued.user.name, role: issued.user.role }
        }
      } catch (error) {
        this.log.warn(`auto-login token issuance failed for ${intent.adminEmail}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return {
      intentId: intent.id,
      clinicName: intent.clinicName,
      plan: intent.plan,
      subdomain: intent.tenant?.subdomain || intent.requestedSubdomain,
      onboardingStatus: intent.status,
      subscriptionStatus,
      loginAllowed,
      auth,
      message:
        intent.status === 'PROVISIONED'
          ? 'Sua clínica foi ativada com sucesso.'
          : intent.status === 'FAILED'
            ? 'Seu onboarding falhou e precisa de revisão da equipe de suporte.'
            : intent.status === 'EXPIRED'
              ? 'Esta sessão expirou. Gere um novo checkout para concluir o cadastro.'
              : 'Estamos confirmando o pagamento e finalizando a criação da clínica.',
      payment: {
        sessionId: intent.providerSessionId,
        checkoutStatus: stripeSessionStatus,
        paymentStatus: stripePaymentStatus
      }
    }
  }

  /** Mesma derivação usada no provisionamento (tenant-provision.service.ts): troca o path do MASTER_DATABASE_URL pelo dbName do tenant. Evita depender de dbUser/dbPassword salvos no Tenant, que já causaram credenciais erradas em Docker. */
  private tenantConnectionUrl(dbName: string, slug: string) {
    if (process.env.DEV_SQLITE === 'true') return `file:./prisma/dev-${slug}.db`
    const masterUrl = process.env.MASTER_DATABASE_URL || ''
    if (!masterUrl) throw new Error('MASTER_DATABASE_URL não configurada')
    const u = new URL(masterUrl)
    u.pathname = '/' + dbName.replace(/^\//, '')
    return u.toString()
  }

  /**
   * Price ID configurado no Stripe para cada plano e ciclo de cobrança. Nunca
   * reaproveitar o Price de outro plano/ciclo — isso cobraria do cliente um
   * valor diferente do anunciado.
   */
  private configuredPriceId(plan: Plan, interval: BillingInterval): string | undefined {
    const envVar =
      interval === 'YEAR'
        ? ({ BASIC: 'STRIPE_PRICE_BASIC_YEARLY', PRO: 'STRIPE_PRICE_PRO_YEARLY', CLINIC: 'STRIPE_PRICE_CLINIC_YEARLY' } as const)
        : ({ BASIC: 'STRIPE_PRICE_BASIC_MONTHLY', PRO: 'STRIPE_PRICE_PRO_MONTHLY', CLINIC: 'STRIPE_PRICE_CLINIC_MONTHLY' } as const)
    const key = envVar[plan as 'BASIC' | 'PRO' | 'CLINIC']
    return key ? process.env[key]?.trim() || undefined : undefined
  }

  private assertPriceMatchesPlan(price: any, plan: PlanPublicInfo, interval: BillingInterval) {
    const currency = plan.currency.toLowerCase()
    const expectedAmount = interval === 'YEAR' ? plan.annualPriceCents : plan.priceCents
    const expectedInterval = interval === 'YEAR' ? 'year' : 'month'
    const valid =
      price.active &&
      price.unit_amount === expectedAmount &&
      price.currency === currency &&
      price.recurring?.interval === expectedInterval &&
      (price.recurring?.interval_count ?? 1) === 1 &&
      !price.recurring?.usage_type?.includes('metered')
    if (!valid) {
      this.log.error(
        `Stripe Price ${price.id} diverge do plano ${plan.code}/${interval}: esperado ${currency} ${expectedAmount}/${expectedInterval}.`
      )
      throw new ServiceUnavailableException('O preço deste plano está temporariamente indisponível para cobrança.')
    }
  }

  /**
   * Em live mode, todo plano/ciclo precisa apontar para um Price explícito e validado.
   * Em sandbox, lookup_key evita criar preços duplicados a cada reinício.
   */
  private resolvePriceId(stripe: Stripe.Stripe, plan: PlanPublicInfo, interval: BillingInterval = 'MONTH'): Promise<string> {
    const cacheKey = `${plan.code}:${interval}`
    const cached = this.priceIdCache.get(cacheKey)
    if (cached) return cached

    const promise = (async () => {
      const configured = this.configuredPriceId(plan.code, interval)
      if (configured) {
        const price = await stripe.prices.retrieve(configured)
        this.assertPriceMatchesPlan(price, plan, interval)
        return price.id
      }

      if (this.stripeKeyIsLive()) {
        this.log.error(`STRIPE_PRICE_${plan.code}_${interval === 'YEAR' ? 'YEARLY' : 'MONTHLY'} não configurado em live mode.`)
        throw new ServiceUnavailableException('O preço deste plano ainda não está configurado para cobrança.')
      }

      const lookupKey = `odontoapp_${plan.code.toLowerCase()}_${interval === 'YEAR' ? 'yearly' : 'monthly'}`
      const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
      if (existing.data[0]) {
        this.assertPriceMatchesPlan(existing.data[0], plan, interval)
        return existing.data[0].id
      }

      const price = await stripe.prices.create({
        unit_amount: interval === 'YEAR' ? plan.annualPriceCents : plan.priceCents,
        currency: plan.currency.toLowerCase(),
        recurring: { interval: interval === 'YEAR' ? 'year' : 'month' },
        lookup_key: lookupKey,
        metadata: { plan: plan.code, billingInterval: interval },
        product_data: {
          name: `OdontoApp ${plan.name}`,
          metadata: { product: 'odontoapp', plan: plan.code }
        }
      })
      return price.id
    })()

    this.priceIdCache.set(cacheKey, promise)
    promise.catch(() => this.priceIdCache.delete(cacheKey))
    return promise
  }

  /** Assinatura atual da clínica autenticada + planos disponíveis para troca. */
  async getSubscriptionForTenant(tenantId: string, dentistUsed: number) {
    let subscription = await this.master.subscription.findUnique({ where: { tenantId } })
    if (subscription?.provider === 'STRIPE' && subscription.providerSubscriptionId) {
      try {
        const current = await this.retrieveStripeSubscription(subscription.providerSubscriptionId)
        if (current) {
          await this.onSubscriptionUpdated(current)
          subscription = await this.master.subscription.findUnique({ where: { tenantId } })
        }
      } catch { this.log.warn(`Não foi possível atualizar a assinatura da clínica ${tenantId} ao abrir o plano.`) }
    }
    const storedGrant = await this.master.accessGrant.findUnique({ where: { tenantId } })
    const accessGrant = storedGrant?.active && (!storedGrant.expiresAt || storedGrant.expiresAt.getTime() > Date.now())
      ? storedGrant
      : null
    const plan = accessGrant?.plan ?? subscription?.plan ?? 'FREE'
    const catalog = PLAN_CATALOG[plan]
    return {
      plan,
      planLabel: PLAN_LABEL[plan],
      priceCents: accessGrant ? 0 : subscription?.priceCents ?? catalog?.priceCents ?? 0,
      billingInterval: subscription?.billingInterval ?? 'MONTH',
      status: accessGrant ? 'ACTIVE' : subscription?.status ?? 'PENDING',
      provider: subscription?.provider ?? null,
      renewsAt: subscription?.renewsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      canceledAt: subscription?.canceledAt ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      dentistLimit: accessGrant ? accessGrant.dentistLimit : DENTIST_LIMIT_BY_PLAN[plan],
      dentistUsed,
      accessGrant,
      managedByPlatform: Boolean(accessGrant),
      availablePlans: Object.values(PLAN_CATALOG)
        .filter(p => p.code !== 'FREE')
        .map(p => ({ ...p, dentistLimit: DENTIST_LIMIT_BY_PLAN[p.code], monthlyAvailable: this.priceAvailable(p.code, 'MONTH'), annualAvailable: this.priceAvailable(p.code, 'YEAR') }))
    }
  }

  /**
   * Troca o plano da clínica autenticada. Três caminhos possíveis:
   *  - alvo é FREE: cancela a assinatura no Stripe (se houver) e volta pra grátis na hora.
   *  - já existe assinatura Stripe ativa: atualiza o preço da mesma assinatura (com proração), sem novo checkout.
   *  - não existe assinatura Stripe (ex.: estava no FREE): cria um novo Checkout Session e devolve a URL pro frontend redirecionar.
   */
  async changeTenantPlan(tenantId: string, targetPlanCode: Plan, adminEmail: string, dentistUsed: number) {
    return withBillingLock(`plan-change:${tenantId}`, () => this.changeTenantPlanLocked(tenantId, targetPlanCode, adminEmail, dentistUsed))
  }

  private async changeTenantPlanLocked(tenantId: string, targetPlanCode: Plan, adminEmail: string, dentistUsed: number): Promise<{ ok?: boolean; redirect?: string; message?: string }> {
    const accessGrant = await this.master.accessGrant.findUnique({ where: { tenantId } })
    if (accessGrant?.active && (!accessGrant.expiresAt || accessGrant.expiresAt.getTime() > Date.now())) {
      throw new ConflictException('Este acesso é um benefício administrado pela plataforma. Fale com o suporte para alterar o plano.')
    }
    const target = PLAN_CATALOG[targetPlanCode]
    if (!target) throw new BadRequestException('Plano inválido.')

    const limit = DENTIST_LIMIT_BY_PLAN[targetPlanCode]
    if (limit !== null && dentistUsed > limit) {
      throw new ConflictException(
        `O plano ${PLAN_LABEL[targetPlanCode]} permite até ${limit} ${limit === 1 ? 'dentista' : 'dentistas'} e sua clínica tem ${dentistUsed} cadastrados. Remova dentistas em Equipe antes de trocar de plano.`
      )
    }

    let subscription = await this.master.subscription.findUnique({ where: { tenantId } })
    if (subscription?.provider === 'STRIPE' && subscription.providerSubscriptionId) {
      const current = await this.retrieveStripeSubscription(subscription.providerSubscriptionId)
      if (!current) throw new ServiceUnavailableException('Não foi possível verificar sua assinatura atual. Tente novamente em instantes.')
      await this.onSubscriptionUpdated(current)
      subscription = await this.master.subscription.findUnique({ where: { tenantId } })
    }
    if (
      subscription?.provider === 'STRIPE' &&
      Boolean(subscription.providerSubscriptionId) &&
      subscription?.plan === targetPlanCode &&
      ['ACTIVE', 'TRIAL'].includes(subscription.status) &&
      !subscription.cancelAtPeriodEnd
    ) {
      throw new BadRequestException('Esse já é o plano atual da clínica.')
    }

    const now = new Date()

    // Uma assinatura paga conserva o acesso até o fim do período contratado.
    if (target.priceCents === 0) {
      if (subscription?.provider === 'STRIPE' && subscription.providerSubscriptionId) {
        return this.cancelTenantSubscription(tenantId)
      }
      await this.master.subscription.upsert({
        where: { tenantId },
        update: {
          plan: 'FREE',
          status: 'ACTIVE',
          priceCents: 0,
          billingInterval: 'MONTH',
          provider: null,
          providerCustomerId: null,
          providerSubscriptionId: null,
          activatedAt: now,
          currentPeriodEnd: null,
          renewsAt: null,
          canceledAt: null,
          cancelAtPeriodEnd: false
        },
        create: { tenantId, plan: 'FREE', status: 'ACTIVE', priceCents: 0, startedAt: now, activatedAt: now }
      })
      return { ok: true, message: `Plano alterado para ${target.name}.` }
    }

    const stripe = this.getStripeClient()
    if (!stripe) throw new ServiceUnavailableException('Pagamentos temporariamente indisponíveis.')

    if (subscription?.pendingCheckoutSessionId) {
      const pending = await stripe.checkout.sessions.retrieve(subscription.pendingCheckoutSessionId)
      if (pending.status === 'complete') {
        if (!['paid', 'no_payment_required'].includes(pending.payment_status)) return { ok: false, message: 'Seu pagamento está sendo confirmado. Aguarde antes de iniciar outra assinatura.' }
        await this.onCheckoutSessionPaid(pending)
        if (pending.metadata?.plan === targetPlanCode) return { ok: true, message: 'Assinatura confirmada.' }
        return this.changeTenantPlanLocked(tenantId, targetPlanCode, adminEmail, dentistUsed)
      }
      if (pending.status === 'open') {
        if (pending.metadata?.plan === targetPlanCode && pending.url) return { redirect: pending.url }
        await stripe.checkout.sessions.expire(pending.id)
      }
      await this.master.subscription.update({ where: { tenantId }, data: { pendingCheckoutSessionId: null } })
    }

    // Já existe assinatura Stripe ativa: troca o preço na mesma assinatura, sem novo checkout.
    if (
      subscription?.provider === 'STRIPE' &&
      subscription.providerSubscriptionId &&
      ['ACTIVE', 'TRIAL', 'PAST_DUE'].includes(subscription.status)
    ) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscription.providerSubscriptionId)
        if (['past_due', 'unpaid', 'incomplete', 'paused'].includes(stripeSub.status)) {
          const portal = await this.createPortalSession(tenantId)
          return { ok: false, ...portal, message: 'Regularize a assinatura atual antes de alterar o plano.' }
        }
        const itemId = stripeSub.items.data[0]?.id
        if (!itemId) throw new Error('Assinatura sem item de cobrança no Stripe.')
        // Preserva o ciclo de cobrança já contratado (mensal ou anual) ao trocar de plano.
        const currentInterval = this.billingIntervalFromStripe(stripeSub)
        const priceId = await this.resolvePriceId(stripe, target, currentInterval)

        // O Stripe não aceita cancel_at_period_end junto de
        // payment_behavior=pending_if_incomplete. Se o cliente havia cancelado
        // a renovação, a escolha explícita de outro plano primeiro reativa a
        // assinatura e só então troca o preço.
        if (stripeSub.cancel_at_period_end) {
          await stripe.subscriptions.update(subscription.providerSubscriptionId, {
            cancel_at_period_end: false
          })
        }

        const updated = await stripe.subscriptions.update(subscription.providerSubscriptionId, {
          items: [{ id: itemId, price: priceId }],
          payment_behavior: 'pending_if_incomplete',
          proration_behavior: 'always_invoice',
          expand: ['latest_invoice']
        })
        if ((updated as any).pending_update) {
          const invoice = (updated as any).latest_invoice
          const redirect = typeof invoice === 'object' ? invoice?.hosted_invoice_url : null
          return {
            ok: false,
            redirect: redirect || undefined,
            message: 'A alteração será concluída assim que o pagamento for confirmado.'
          }
        }

        await this.onSubscriptionUpdated(updated as StripeSubscription)
        return { ok: true, message: `Plano alterado para ${target.name}.` }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        this.log.error(`failed to update stripe subscription price: ${detail}`, error instanceof Error ? error.stack : undefined)
        throw new ServiceUnavailableException('Não foi possível alterar o plano agora. Tente novamente em instantes.')
      }
    }

    // Sem assinatura Stripe ativa (ex.: estava no plano gratuito): precisa de um novo checkout.
    // Sem cadência anterior para preservar, o novo checkout começa mensal — quem quiser
    // anual troca depois pelo portal de pagamento ou contata o suporte.
    const successUrl = `${this.getAppBaseUrl()}/app/billing?upgraded=1&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${this.getAppBaseUrl()}/app/billing?canceled=1`
    try {
      const priceId = await this.resolvePriceId(stripe, target, 'MONTH')
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer: subscription?.providerCustomerId || undefined,
          customer_email: subscription?.providerCustomerId ? undefined : adminEmail,
          locale: 'pt-BR',
          payment_method_collection: 'always',
          metadata: { kind: 'plan_change', tenantId, plan: targetPlanCode, billingInterval: 'MONTH' },
          subscription_data: { metadata: { kind: 'plan_change', tenantId, plan: targetPlanCode, billingInterval: 'MONTH' } },
          line_items: [{ price: priceId, quantity: 1 }]
        },
        { timeout: 15000, maxNetworkRetries: 1, idempotencyKey: `plan-${tenantId}-${randomUUID()}` }
      )
      if (!session.url) throw new ServiceUnavailableException('Falha ao gerar link de pagamento.')
      await this.master.subscription.upsert({ where: { tenantId },
        update: { pendingCheckoutSessionId: session.id },
        create: { tenantId, plan: 'FREE', priceCents: 0, status: 'PENDING', pendingCheckoutSessionId: session.id }
      })
      return { redirect: session.url }
    } catch (error) {
      this.log.error({ err: error }, 'failed to create plan-change checkout session')
      throw new ServiceUnavailableException('Não foi possível iniciar o pagamento agora. Tente novamente.')
    }
  }

  async handleStripeWebhook(rawBody: Buffer | undefined, signatureHeader: string) {
    const stripe = this.getStripeClient()
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
    if (!stripe || !endpointSecret) {
      throw new ServiceUnavailableException('Webhook de pagamento não configurado.')
    }
    if (!rawBody || !rawBody.length) {
      throw new BadRequestException('Payload bruto ausente para validação de assinatura.')
    }

    let event: StripeEvent
    try {
      event = stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret)
    } catch (error) {
      this.log.warn(`invalid stripe signature: ${error instanceof Error ? error.message : String(error)}`)
      throw new BadRequestException('Assinatura de webhook inválida.')
    }

    const expectedLivemode = process.env.STRIPE_EXPECTED_LIVEMODE?.trim()
    if (expectedLivemode && Boolean(event.livemode) !== (expectedLivemode === 'true')) {
      this.log.warn(`stripe event ${event.id} rejected: livemode does not match this environment`)
      throw new BadRequestException('Evento Stripe pertence a outro ambiente.')
    }

    return withBillingLock(`stripe-event:${event.id}`, () => this.handleVerifiedStripeEvent(event))
  }

  private async handleVerifiedStripeEvent(event: StripeEvent) {

    const existing = await this.master.paymentEvent.findUnique({
      where: { externalEventId: event.id }
    })
    if (existing?.status === 'PROCESSED') return { received: true, duplicate: true }

    const eventRow = existing
      ? await this.master.paymentEvent.update({
          where: { id: existing.id },
          data: {
            status: 'RECEIVED',
            type: event.type,
            livemode: Boolean(event.livemode),
            payload: event as unknown as Prisma.InputJsonValue,
            error: null,
            processedAt: null,
            attemptCount: { increment: 1 }
          }
        })
      : await this.master.paymentEvent.create({
          data: {
            externalEventId: event.id,
            provider: 'STRIPE',
            type: event.type,
            livemode: Boolean(event.livemode),
            payload: event as unknown as Prisma.InputJsonValue
          }
        })

    try {
      const result = await this.processStripeEvent(event)
      await this.master.paymentEvent.update({
        where: { id: eventRow.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          tenantId: result.tenantId || null,
          signupIntentId: result.signupIntentId || null
        }
      })
      return { received: true }
    } catch (error) {
      this.log.error({ err: error, eventId: event.id, type: event.type }, 'failed processing stripe event')
      await this.master.paymentEvent.update({
        where: { id: eventRow.id },
        data: {
          status: 'FAILED',
          processedAt: new Date(),
          error: error instanceof Error ? error.message : String(error)
        }
      })
      throw error
    }
  }

  private async processStripeEvent(event: StripeEvent) {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return this.onCheckoutSessionPaid(event.data.object as StripeCheckoutSession)
      case 'checkout.session.async_payment_failed':
        return this.onCheckoutSessionPaymentFailed(event.data.object as StripeCheckoutSession)
      case 'checkout.session.expired':
        return this.onCheckoutSessionExpired(event.data.object as StripeCheckoutSession)
      case 'invoice.paid':
        return this.onInvoicePaid(event.data.object as StripeInvoice)
      case 'invoice.payment_failed':
        return this.onInvoicePaymentFailed(event.data.object as StripeInvoice)
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.pending_update_applied':
      case 'customer.subscription.pending_update_expired':
        // Stripe can deliver events out of order. Reconcile the current object,
        // never regress an active/cancelled account using an older event body.
        return this.onSubscriptionUpdated(await this.retrieveStripeSubscription(event.data.object.id) || event.data.object)
      default:
        return { tenantId: null, signupIntentId: null }
    }
  }

  private resolveIntentIdFromSession(session: StripeCheckoutSession) {
    const fromRef = session.client_reference_id?.trim()
    if (fromRef) return fromRef
    const fromMeta = session.metadata?.intentId?.trim()
    if (fromMeta) return fromMeta
    return null
  }

  private async onCheckoutSessionPaymentFailed(session: StripeCheckoutSession) {
    const intent = await this.findIntentBySession(session)
    if (!intent) return { tenantId: null, signupIntentId: null }

    await this.master.signupIntent.update({
      where: { id: intent.id },
      data: {
        status: 'FAILED',
        failedReason: 'Pagamento não aprovado.'
      }
    })

    return { tenantId: intent.tenantId, signupIntentId: intent.id }
  }

  private async onCheckoutSessionExpired(session: StripeCheckoutSession) {
    const intent = await this.findIntentBySession(session)
    if (!intent) return { tenantId: null, signupIntentId: null }

    if (intent.status === 'PROVISIONED') {
      return { tenantId: intent.tenantId, signupIntentId: intent.id }
    }

    await this.master.signupIntent.update({
      where: { id: intent.id },
      data: {
        status: 'EXPIRED',
        failedReason: 'Checkout expirado sem confirmação de pagamento.'
      }
    })
    return { tenantId: intent.tenantId, signupIntentId: intent.id }
  }

  private async findIntentBySession(session: StripeCheckoutSession) {
    const intentId = this.resolveIntentIdFromSession(session)
    if (intentId) {
      const found = await this.master.signupIntent.findUnique({ where: { id: intentId } })
      if (found) return found
    }
    return this.master.signupIntent.findFirst({
      where: { providerSessionId: session.id }
    })
  }

  private async onCheckoutSessionPaid(session: StripeCheckoutSession) {
    // Never grant access on an unpaid or uncompleted checkout, even if it is a
    // plan-change session. Both browser reconciliation and webhooks use this gate.
    if (session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) {
      return { tenantId: null, signupIntentId: null }
    }
    return withBillingLock(`stripe-checkout:${session.id}`, () => this.fulfillCheckoutSession(session))
  }

  private async fulfillCheckoutSession(session: StripeCheckoutSession) {
    // Troca de plano de uma clínica já existente (não é um novo cadastro) —
    // não tem SignupIntent, então trata à parte, direto na Subscription.
    if (session.metadata?.kind === 'plan_change' && session.metadata?.tenantId) {
      return this.onPlanChangeCheckoutPaid(session)
    }

    const intent = await this.findIntentBySession(session)
    if (!intent) {
      this.log.warn(`signup intent not found for checkout session ${session.id}`)
      return { tenantId: null, signupIntentId: null }
    }

    const providerCustomerId = this.expandableId(session.customer) || intent.providerCustomerId
    const providerSubscriptionId = this.expandableId(session.subscription) || intent.providerSubscriptionId
    const stripeSubscription = await this.retrieveStripeSubscription(providerSubscriptionId)

    await this.master.signupIntent.update({
      where: { id: intent.id },
      data: {
        providerSessionId: session.id,
        providerCustomerId,
        providerSubscriptionId
      }
    })

    if (session.payment_status === 'unpaid') {
      await this.master.signupIntent.update({
        where: { id: intent.id },
        data: {
          status: 'PROCESSING'
        }
      })
      return { tenantId: intent.tenantId, signupIntentId: intent.id }
    }

    if (intent.status === 'PROVISIONED' && intent.tenantId) {
      return { tenantId: intent.tenantId, signupIntentId: intent.id }
    }

    await this.master.signupIntent.update({
      where: { id: intent.id },
      data: {
        status: 'PROCESSING',
        paidAt: session.payment_status === 'paid' ? new Date() : intent.paidAt
      }
    })

    let tenant = intent.tenantId ? await this.master.tenant.findUnique({ where: { id: intent.tenantId } }) : null
    if (!tenant) tenant = await this.master.tenant.findUnique({ where: { subdomain: intent.requestedSubdomain } })
    if (tenant) {
      if (tenant.provisionSignupIntentId !== intent.id) throw new ConflictException('O endereço reservado pertence a outro cadastro. Entre em contato com o suporte.')
      const owner = await this.master.loginIdentity.findUnique({ where: { email: intent.adminEmail } })
      if (owner && owner.tenantId !== tenant.id) throw new ConflictException('Este e-mail pertence a outra clínica. Entre em contato com o suporte.')
    } else {
      const provisioned = await this.provision.provision({
        name: intent.clinicName,
        subdomain: intent.requestedSubdomain,
        adminEmail: intent.adminEmail,
        adminPasswordHash: intent.adminPasswordHash,
        adminName: intent.adminName || undefined,
        signupIntentId: intent.id
      })
      tenant = await this.master.tenant.findUnique({ where: { slug: provisioned.slug } })
    }
    if (!tenant) throw new Error('Tenant provisionado não encontrado no master.')

    // Persist the durable association immediately. A subsequent Stripe/database
    // failure resumes this tenant instead of attempting CREATE DATABASE again.
    await this.master.signupIntent.update({ where: { id: intent.id }, data: { tenantId: tenant.id } })
    await this.provision.ensureSignupAdmin(tenant.dbName, { email: intent.adminEmail, name: intent.adminName || 'Administrador', passwordHash: intent.adminPasswordHash })

    await this.master.loginIdentity.upsert({
      where: { email: intent.adminEmail },
      update: { tenantId: tenant.id },
      create: { email: intent.adminEmail, tenantId: tenant.id }
    })

    const now = new Date()
    const status: SubscriptionStatus = stripeSubscription
      ? this.toInternalSubscriptionStatus(stripeSubscription.status)
      : session.payment_status === 'paid'
        ? 'ACTIVE'
        : 'TRIAL'
    const currentPeriodEnd = this.stripeSubscriptionPeriodEnd(stripeSubscription)
    const lastPaymentAt = session.payment_status === 'paid' ? now : null
    const cancelAtPeriodEnd = Boolean(stripeSubscription?.cancel_at_period_end)
    const billingInterval: BillingInterval = stripeSubscription
      ? this.billingIntervalFromStripe(stripeSubscription)
      : session.metadata?.billingInterval === 'YEAR'
        ? 'YEAR'
        : 'MONTH'

    const subscription = await this.master.subscription.upsert({
      where: { tenantId: tenant.id },
      update: {
        plan: intent.plan,
        status,
        priceCents: intent.priceCents,
        billingInterval,
        currency: intent.currency,
        provider: 'STRIPE',
        providerCustomerId,
        providerSubscriptionId,
        activatedAt: now,
        lastPaymentAt,
        currentPeriodEnd,
        renewsAt: currentPeriodEnd,
        canceledAt: null,
        cancelAtPeriodEnd
      },
      create: {
        tenantId: tenant.id,
        plan: intent.plan,
        status,
        priceCents: intent.priceCents,
        billingInterval,
        currency: intent.currency,
        provider: 'STRIPE',
        providerCustomerId,
        providerSubscriptionId,
        startedAt: now,
        activatedAt: now,
        lastPaymentAt,
        currentPeriodEnd,
        renewsAt: currentPeriodEnd,
        cancelAtPeriodEnd
      }
    })

    await this.master.signupIntent.update({
      where: { id: intent.id },
      data: {
        status: 'PROVISIONED',
        activatedAt: now,
        tenantId: tenant.id,
        providerCustomerId: subscription.providerCustomerId,
        providerSubscriptionId: subscription.providerSubscriptionId
      }
    })

    await this.sendWelcomeEmail({
      to: intent.adminEmail,
      adminName: intent.adminName || 'Administrador',
      clinicName: intent.clinicName,
      subdomain: tenant.subdomain
    })

    return { tenantId: tenant.id, signupIntentId: intent.id }
  }

  /** Confirma no webhook a troca de plano de uma clínica já existente (checkout criado por changeTenantPlan). */
  private async onPlanChangeCheckoutPaid(session: StripeCheckoutSession) {
    const tenantId = String(session.metadata.tenantId)
    const plan = session.metadata.plan as Plan
    const catalog = PLAN_CATALOG[plan]
    if (!catalog) {
      this.log.warn(`plan_change webhook with unknown plan ${plan}`)
      return { tenantId, signupIntentId: null }
    }

    const now = new Date()
    const providerCustomerId = this.expandableId(session.customer)
    const providerSubscriptionId = this.expandableId(session.subscription)
    const existing = await this.master.subscription.findUnique({ where: { tenantId } })
    if (existing?.providerSubscriptionId === providerSubscriptionId && providerSubscriptionId) {
      const current = await this.retrieveStripeSubscription(providerSubscriptionId)
      if (current) await this.onSubscriptionUpdated(current)
      return { tenantId, signupIntentId: null }
    }
    if (existing?.pendingCheckoutSessionId !== session.id) {
      this.log.warn(`Ignoring superseded plan-change checkout ${session.id} for tenant ${tenantId}`)
      return { tenantId, signupIntentId: null }
    }
    const stripeSubscription = await this.retrieveStripeSubscription(providerSubscriptionId)
    const status: SubscriptionStatus = stripeSubscription
      ? this.toInternalSubscriptionStatus(stripeSubscription.status)
      : session.payment_status === 'paid'
        ? 'ACTIVE'
        : 'TRIAL'
    const currentPeriodEnd = this.stripeSubscriptionPeriodEnd(stripeSubscription)
    const lastPaymentAt = session.payment_status === 'paid' ? now : null
    const cancelAtPeriodEnd = Boolean(stripeSubscription?.cancel_at_period_end)

    // O checkout de troca de plano sem assinatura Stripe ativa sempre parte do mensal
    // (ver changeTenantPlan) — o preço já reflete isso, não precisa reler do Stripe.
    const billingInterval: BillingInterval = 'MONTH'

    await this.master.subscription.upsert({
      where: { tenantId },
      update: {
        plan,
        pendingCheckoutSessionId: null,
        status,
        priceCents: catalog.priceCents,
        billingInterval,
        currency: catalog.currency,
        provider: 'STRIPE',
        providerCustomerId: providerCustomerId || undefined,
        providerSubscriptionId: providerSubscriptionId || undefined,
        activatedAt: now,
        lastPaymentAt,
        currentPeriodEnd,
        renewsAt: currentPeriodEnd,
        canceledAt: null,
        cancelAtPeriodEnd
      },
      create: {
        tenantId,
        plan,
        status,
        priceCents: catalog.priceCents,
        billingInterval,
        currency: catalog.currency,
        provider: 'STRIPE',
        providerCustomerId,
        providerSubscriptionId,
        startedAt: now,
        activatedAt: now,
        lastPaymentAt,
        currentPeriodEnd,
        renewsAt: currentPeriodEnd,
        cancelAtPeriodEnd
      }
    })

    return { tenantId, signupIntentId: null }
  }

  private async onInvoicePaid(invoice: StripeInvoice) {
    const subscriptionId = this.invoiceSubscriptionId(invoice)
    if (!subscriptionId) return { tenantId: null, signupIntentId: null }

    const subscription = await this.master.subscription.findFirst({
      where: { providerSubscriptionId: subscriptionId },
      include: { tenant: true }
    })
    if (!subscription) return { tenantId: null, signupIntentId: null }

    const stripeSubscription = await this.retrieveStripeSubscription(subscriptionId)
    const periodEndFromLine = invoice.lines?.data?.[0]?.period?.end
    const currentPeriodEnd =
      this.stripeSubscriptionPeriodEnd(stripeSubscription) ||
      asIsoOrNull(periodEndFromLine) ||
      subscription.currentPeriodEnd ||
      null
    const status = stripeSubscription
      ? this.toInternalSubscriptionStatus(stripeSubscription.status)
      : 'ACTIVE'

    await this.master.subscription.updateMany({
      where: { id: subscription.id, providerSubscriptionId: subscriptionId },
      data: {
        status,
        lastPaymentAt: Number(invoice.amount_paid || 0) > 0 ? new Date() : subscription.lastPaymentAt,
        currentPeriodEnd,
        renewsAt: currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(stripeSubscription?.cancel_at_period_end)
      }
    })

    return { tenantId: subscription.tenantId, signupIntentId: null }
  }

  private async onInvoicePaymentFailed(invoice: StripeInvoice) {
    const subscriptionId = this.invoiceSubscriptionId(invoice)
    if (!subscriptionId) return { tenantId: null, signupIntentId: null }

    const subscription = await this.master.subscription.findFirst({
      where: { providerSubscriptionId: subscriptionId },
      include: { tenant: true }
    })
    if (!subscription) return { tenantId: null, signupIntentId: null }

    const current = await this.retrieveStripeSubscription(subscriptionId)
    const currentStatus = current ? this.toInternalSubscriptionStatus(current.status) : 'PAST_DUE'
    await this.master.subscription.updateMany({
      where: { id: subscription.id, providerSubscriptionId: subscriptionId },
      data: {
        status: currentStatus
      }
    })

    try {
      const adminEmail = await this.master.loginIdentity.findFirst({
        where: { tenantId: subscription.tenantId },
        orderBy: { createdAt: 'asc' }
      })
      if (adminEmail?.email && currentStatus === 'PAST_DUE') {
        await this.mailer.send(
          adminEmail.email,
          'Pagamento da assinatura não foi aprovado',
          `<p>Olá,</p><p>Não conseguimos aprovar a renovação da sua assinatura da clínica <strong>${subscription.tenant.name}</strong>.</p><p>Regularize o pagamento para restabelecer o acesso completo.</p>`
        )
      }
    } catch (error) {
      this.log.warn(`failed sending payment-failed email: ${error instanceof Error ? error.message : String(error)}`)
    }

    return { tenantId: subscription.tenantId, signupIntentId: null }
  }

  private async onSubscriptionUpdated(stripeSubscription: StripeSubscription) {
    const providerSubscriptionId = stripeSubscription.id
    const subscription = await this.master.subscription.findFirst({
      where: { providerSubscriptionId },
      include: { tenant: true }
    })
    if (!subscription) return { tenantId: null, signupIntentId: null }

    const status = this.toInternalSubscriptionStatus(stripeSubscription.status)
    const currentPeriodEnd = asIsoOrNull(stripeSubscription.current_period_end)
    const canceledAt = asIsoOrNull(stripeSubscription.canceled_at)
    const mappedPlan = this.planFromStripeSubscription(stripeSubscription)
    const mappedCatalog = mappedPlan ? PLAN_CATALOG[mappedPlan] : null
    const billingInterval = this.billingIntervalFromStripe(stripeSubscription)

    await this.master.subscription.updateMany({
      where: { id: subscription.id, providerSubscriptionId },
      data: {
        ...(mappedPlan && mappedCatalog
          ? {
              plan: mappedPlan,
              priceCents: billingInterval === 'YEAR' ? mappedCatalog.annualPriceCents : mappedCatalog.priceCents,
              currency: mappedCatalog.currency
            }
          : {}),
        billingInterval,
        status,
        currentPeriodEnd: currentPeriodEnd || this.stripeSubscriptionPeriodEnd(stripeSubscription) || subscription.currentPeriodEnd,
        renewsAt: currentPeriodEnd || this.stripeSubscriptionPeriodEnd(stripeSubscription) || subscription.renewsAt,
        cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
        canceledAt:
          status === 'CANCELED'
            ? canceledAt || new Date()
            : null
      }
    })

    const relatedIntent = await this.master.signupIntent.findFirst({
      where: { providerSubscriptionId },
      orderBy: { createdAt: 'desc' }
    })

    if (relatedIntent && relatedIntent.status !== 'PROVISIONED' && status === 'CANCELED') {
      await this.master.signupIntent.update({
        where: { id: relatedIntent.id },
        data: {
          status: 'FAILED',
          failedReason: 'Assinatura cancelada antes do provisionamento.'
        }
      })
    }

    return { tenantId: subscription.tenantId, signupIntentId: relatedIntent?.id || null }
  }

  async createPortalSession(tenantId: string) {
    const subscription = await this.master.subscription.findUnique({ where: { tenantId } })
    if (!subscription?.providerCustomerId) {
      throw new BadRequestException('Esta assinatura ainda não possui uma cobrança vinculada.')
    }
    const stripe = this.getStripeClient()
    if (!stripe) throw new ServiceUnavailableException('Pagamentos temporariamente indisponíveis.')

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.providerCustomerId,
        configuration: process.env.STRIPE_PORTAL_CONFIGURATION?.trim() || undefined,
        return_url: `${this.getAppBaseUrl()}/app/billing`
      })
      return { redirect: session.url }
    } catch (error) {
      this.log.error({ err: error }, 'failed to create Stripe customer portal session')
      throw new ServiceUnavailableException('Não foi possível abrir o portal de pagamento agora.')
    }
  }

  /** Authenticated reconciliation of an existing tenant's checkout on return. */
  async reconcileTenantCheckout(tenantId: string, sessionId: string) {
    const stripe = this.getStripeClient()
    if (!stripe) throw new ServiceUnavailableException('Pagamentos temporariamente indisponíveis.')
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.kind !== 'plan_change' || session.metadata?.tenantId !== tenantId) {
      throw new NotFoundException('Pagamento não encontrado para esta clínica.')
    }
    await this.onCheckoutSessionPaid(session)
    return { complete: session.status === 'complete' && ['paid', 'no_payment_required'].includes(session.payment_status), status: session.status }
  }

  async cancelTenantSubscription(tenantId: string) {
    const subscription = await this.master.subscription.findUnique({ where: { tenantId } })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada.')
    if (subscription.cancelAtPeriodEnd) {
      return { ok: true, message: 'A renovação desta assinatura já está cancelada.' }
    }

    if (subscription.provider !== 'STRIPE' || !subscription.providerSubscriptionId) {
      await this.master.subscription.update({
        where: { tenantId },
        data: { status: 'CANCELED', canceledAt: new Date(), cancelAtPeriodEnd: false }
      })
      return { ok: true, message: 'Assinatura cancelada.' }
    }

    const stripe = this.getStripeClient()
    if (!stripe) throw new ServiceUnavailableException('Pagamentos temporariamente indisponíveis.')
    try {
      const updated = await stripe.subscriptions.update(subscription.providerSubscriptionId, {
        cancel_at_period_end: true
      })
      const currentPeriodEnd = this.stripeSubscriptionPeriodEnd(updated as StripeSubscription)
      await this.master.subscription.update({
        where: { tenantId },
        data: {
          status: this.toInternalSubscriptionStatus(updated.status),
          cancelAtPeriodEnd: true,
          currentPeriodEnd: currentPeriodEnd || subscription.currentPeriodEnd,
          renewsAt: currentPeriodEnd || subscription.renewsAt,
          canceledAt: null
        }
      })
      return {
        ok: true,
        message: currentPeriodEnd
          ? `Renovação cancelada. O acesso permanece ativo até ${currentPeriodEnd.toLocaleDateString('pt-BR')}.`
          : 'Renovação cancelada. O acesso permanece ativo até o fim do período contratado.'
      }
    } catch (error) {
      this.log.error({ err: error }, 'failed to schedule Stripe subscription cancellation')
      throw new ServiceUnavailableException('Não foi possível cancelar a renovação agora. Tente novamente.')
    }
  }

  async listPaymentEvents(tenantId?: string) {
    const rows = await this.master.paymentEvent.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { receivedAt: 'desc' },
      take: 200
    })

    return rows.map(row => ({
      id: row.id,
      provider: row.provider,
      type: row.type,
      status: row.status,
      receivedAt: row.receivedAt,
      processedAt: row.processedAt,
      tenantId: row.tenantId,
      signupIntentId: row.signupIntentId,
      error: row.error
    }))
  }

  async getTenantAccessStatusByTenantId(tenantId: string) {
    const sub = await this.master.subscription.findUnique({ where: { tenantId } })
    if (!sub) {
      return { allowed: false, status: 'PENDING', message: 'Assinatura pendente de ativação.' }
    }
    const allowed = sub.status === 'ACTIVE' || sub.status === 'TRIAL'
    return {
      allowed,
      status: sub.status,
      message: allowed
        ? 'Assinatura ativa.'
        : `Assinatura ${readableSubscriptionStatus(sub.status)}. Regularize para continuar.`
    }
  }

  private async sendWelcomeEmail(input: { to: string; adminName: string; clinicName: string; subdomain: string }) {
    try {
      await this.mailer.send(
        input.to,
        'Bem-vindo ao Odonto SaaS',
        `<p>Olá, ${input.adminName}.</p>
         <p>Sua clínica <strong>${input.clinicName}</strong> foi ativada com sucesso.</p>
         <p>Subdomínio da clínica: <strong>${input.subdomain}</strong></p>
         <p>Você já pode entrar e começar o onboarding inicial da equipe.</p>`
      )
    } catch (error) {
      this.log.warn(`failed sending welcome email: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
