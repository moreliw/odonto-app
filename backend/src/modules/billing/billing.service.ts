import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common'
import { Prisma, Plan, SignupIntent, SubscriptionStatus } from '@prisma/client-master'
import Stripe = require('stripe')
import * as argon2 from 'argon2'
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
}

type PlanPublicInfo = {
  code: Plan
  name: string
  priceCents: number
  currency: string
  description: string
  features: string[]
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
const PLAN_CATALOG: Partial<Record<Plan, PlanPublicInfo>> = {
  FREE: {
    code: 'FREE',
    name: 'Teste Gratuito',
    priceCents: 0,
    currency: 'BRL',
    description: 'Uso interno para testar o fluxo completo de assinatura, sem cobrança.',
    features: ['Todos os módulos liberados', 'Sem cartão de crédito', 'Ativação imediata']
  },
  BASIC: {
    code: 'BASIC',
    name: 'Essencial',
    priceCents: 12900,
    currency: 'BRL',
    description: 'Para profissionais autônomos e consultórios menores.',
    features: ['Agenda e pacientes', 'Prontuário digital', 'Financeiro básico', 'Suporte por e-mail']
  },
  PRO: {
    code: 'PRO',
    name: 'Profissional',
    priceCents: 27900,
    currency: 'BRL',
    description: 'Para consultórios e clínicas que trabalham com equipe.',
    features: ['Tudo do Essencial', 'Até 3 dentistas', 'Perfis de acesso', 'Suporte prioritário']
  },
  CLINIC: {
    code: 'CLINIC',
    name: 'Clínica',
    priceCents: 44900,
    currency: 'BRL',
    description: 'Para clínicas com vários profissionais e volume alto de atendimento.',
    features: ['Tudo do Profissional', 'Dentistas ilimitados', 'Armazenamento ampliado', 'Atendimento prioritário']
  }
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
  private readonly priceIdCache = new Map<Plan, Promise<string>>()

  constructor(
    private readonly master: MasterPrismaService,
    private readonly provision: TenantProvisionService,
    private readonly mailer: MailerService,
    private readonly auth: AuthService
  ) {}

  getPublicPlans() {
    return Object.values(PLAN_CATALOG).filter(plan => plan.code !== 'FREE' || this.freeSignupsEnabled())
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
    return asIsoOrNull(topLevel || itemLevel)
  }

  private planFromStripeSubscription(subscription: StripeSubscription): Plan | null {
    const price = subscription.items?.data?.[0]?.price
    if (!price) return null
    const priceId = typeof price === 'string' ? price : price.id
    for (const code of ['BASIC', 'PRO', 'CLINIC'] as Plan[]) {
      if (this.configuredPriceId(code) === priceId) return code
    }

    const metadataPlan = typeof price === 'string' ? null : price.metadata?.plan
    if (metadataPlan && PLAN_CATALOG[metadataPlan as Plan]) return metadataPlan as Plan

    if (typeof price !== 'string') {
      const byAmount = Object.values(PLAN_CATALOG).find(
        plan =>
          plan.code !== 'FREE' &&
          price.unit_amount === plan.priceCents &&
          price.currency === plan.currency.toLowerCase() &&
          price.recurring?.interval === 'month'
      )
      return byAmount?.code || null
    }
    return null
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

    const seed = normalizeSubdomain(rawClinicName)
    if (!seed) throw new BadRequestException('Nome da clínica inválido para geração de subdomínio.')
    if (await this.isSubdomainAvailable(seed)) return seed

    for (let i = 2; i <= 200; i++) {
      const candidate = `${seed}-${i}`
      if (await this.isSubdomainAvailable(candidate)) return candidate
    }
    throw new ConflictException('Não foi possível gerar um subdomínio disponível. Tente definir manualmente.')
  }

  async createCheckoutSession(input: CheckoutRequest) {
    const plan = PLAN_CATALOG[input.plan]
    if (plan?.code === 'FREE' && !this.freeSignupsEnabled()) {
      throw new BadRequestException('O plano gratuito é restrito ao ambiente interno de testes.')
    }
    if (!plan) throw new BadRequestException('Plano inválido.')

    const clinicName = input.clinicName.trim()
    if (clinicName.length < 3) throw new BadRequestException('Informe o nome da clínica.')
    const adminEmail = input.adminEmail.trim().toLowerCase()
    const adminPassword = input.adminPassword
    if (adminPassword.length < 8) throw new BadRequestException('A senha deve ter no mínimo 8 caracteres.')

    const existingIdentity = await this.master.loginIdentity.findUnique({ where: { email: adminEmail } })
    if (existingIdentity) {
      throw new ConflictException('Este e-mail já está vinculado a uma clínica. Faça login para continuar.')
    }

    const requestedSubdomain = await this.resolveSubdomain(clinicName, input.requestedSubdomain)
    const clinicSlug = slugify(clinicName)
    const adminPasswordHash = await argon2.hash(adminPassword)

    const intent = await this.master.signupIntent.create({
      data: {
        clinicName,
        clinicSlug,
        requestedSubdomain,
        adminName: input.adminName?.trim() || null,
        adminEmail,
        adminPasswordHash,
        plan: plan.code,
        priceCents: plan.priceCents,
        currency: plan.currency,
        status: 'PENDING',
        metadata: {
          source: 'landing',
          ipHint: 'web'
        }
      }
    })

    if (plan.priceCents === 0) {
      return this.activateFreeSignup(intent, plan)
    }

    const stripe = this.getStripeClient()
    if (!stripe) throw new ServiceUnavailableException('Pagamentos temporariamente indisponíveis.')

    const successUrl = `${this.getAppBaseUrl()}/signup/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${this.getAppBaseUrl()}/signup?canceled=1`
    const trialDays = this.trialDays()

    try {
      const priceId = await this.resolvePriceId(stripe, plan)
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        client_reference_id: intent.id,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: adminEmail,
        payment_method_collection: trialDays > 0 ? 'if_required' : 'always',
        metadata: {
          intentId: intent.id,
          clinicSlug: clinicSlug.slice(0, 40),
          plan: plan.code
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
            plan: plan.code
          }
        },
        line_items: [{ price: priceId, quantity: 1 }]
      }, { timeout: 15000, maxNetworkRetries: 0 })

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
    if (loginAllowed && intent.tenant) {
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
   * Price ID configurado no Stripe para cada plano. Nunca reaproveitar o Price
   * de outro plano — isso cobraria do cliente um valor diferente do anunciado.
   */
  private configuredPriceId(plan: Plan): string | undefined {
    const byPlan: Partial<Record<Plan, string | undefined>> = {
      BASIC: process.env.STRIPE_PRICE_BASIC_MONTHLY?.trim(),
      PRO: process.env.STRIPE_PRICE_PRO_MONTHLY?.trim(),
      CLINIC: process.env.STRIPE_PRICE_CLINIC_MONTHLY?.trim()
    }
    return byPlan[plan] || undefined
  }

  private assertPriceMatchesPlan(price: any, plan: PlanPublicInfo) {
    const currency = plan.currency.toLowerCase()
    const valid =
      price.active &&
      price.unit_amount === plan.priceCents &&
      price.currency === currency &&
      price.recurring?.interval === 'month'
    if (!valid) {
      this.log.error(
        `Stripe Price ${price.id} diverge do plano ${plan.code}: esperado ${currency} ${plan.priceCents}/month.`
      )
      throw new ServiceUnavailableException('O preço deste plano está temporariamente indisponível para cobrança.')
    }
  }

  /**
   * Em live mode, todo plano precisa apontar para um Price explícito e validado.
   * Em sandbox, lookup_key evita criar preços duplicados a cada reinício.
   */
  private resolvePriceId(stripe: Stripe.Stripe, plan: PlanPublicInfo): Promise<string> {
    const cached = this.priceIdCache.get(plan.code)
    if (cached) return cached

    const promise = (async () => {
      const configured = this.configuredPriceId(plan.code)
      if (configured) {
        const price = await stripe.prices.retrieve(configured)
        this.assertPriceMatchesPlan(price, plan)
        return price.id
      }

      if (this.stripeKeyIsLive()) {
        this.log.error(`STRIPE_PRICE_${plan.code}_MONTHLY não configurado em live mode.`)
        throw new ServiceUnavailableException('O preço deste plano ainda não está configurado para cobrança.')
      }

      const lookupKey = `odontoapp_${plan.code.toLowerCase()}_monthly`
      const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
      if (existing.data[0]) {
        this.assertPriceMatchesPlan(existing.data[0], plan)
        return existing.data[0].id
      }

      const price = await stripe.prices.create({
        unit_amount: plan.priceCents,
        currency: plan.currency.toLowerCase(),
        recurring: { interval: 'month' },
        lookup_key: lookupKey,
        metadata: { plan: plan.code },
        product_data: {
          name: `OdontoApp ${plan.name}`,
          metadata: { product: 'odontoapp', plan: plan.code }
        }
      })
      return price.id
    })()

    this.priceIdCache.set(plan.code, promise)
    promise.catch(() => this.priceIdCache.delete(plan.code))
    return promise
  }

  /** Assinatura atual da clínica autenticada + planos disponíveis para troca. */
  async getSubscriptionForTenant(tenantId: string, dentistUsed: number) {
    const subscription = await this.master.subscription.findUnique({ where: { tenantId } })
    const plan = subscription?.plan ?? 'FREE'
    const catalog = PLAN_CATALOG[plan]
    return {
      plan,
      planLabel: PLAN_LABEL[plan],
      priceCents: subscription?.priceCents ?? catalog?.priceCents ?? 0,
      status: subscription?.status ?? 'PENDING',
      provider: subscription?.provider ?? null,
      renewsAt: subscription?.renewsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      canceledAt: subscription?.canceledAt ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      dentistLimit: DENTIST_LIMIT_BY_PLAN[plan],
      dentistUsed,
      availablePlans: Object.values(PLAN_CATALOG)
        .filter(p => p.code !== 'FREE')
        .map(p => ({ ...p, dentistLimit: DENTIST_LIMIT_BY_PLAN[p.code] }))
    }
  }

  /**
   * Troca o plano da clínica autenticada. Três caminhos possíveis:
   *  - alvo é FREE: cancela a assinatura no Stripe (se houver) e volta pra grátis na hora.
   *  - já existe assinatura Stripe ativa: atualiza o preço da mesma assinatura (com proração), sem novo checkout.
   *  - não existe assinatura Stripe (ex.: estava no FREE): cria um novo Checkout Session e devolve a URL pro frontend redirecionar.
   */
  async changeTenantPlan(tenantId: string, targetPlanCode: Plan, adminEmail: string, dentistUsed: number) {
    const target = PLAN_CATALOG[targetPlanCode]
    if (!target) throw new BadRequestException('Plano inválido.')

    const limit = DENTIST_LIMIT_BY_PLAN[targetPlanCode]
    if (limit !== null && dentistUsed > limit) {
      throw new ConflictException(
        `O plano ${PLAN_LABEL[targetPlanCode]} permite até ${limit} ${limit === 1 ? 'dentista' : 'dentistas'} e sua clínica tem ${dentistUsed} cadastrados. Remova dentistas em Equipe antes de trocar de plano.`
      )
    }

    const subscription = await this.master.subscription.findUnique({ where: { tenantId } })
    if (
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

    // Já existe assinatura Stripe ativa: troca o preço na mesma assinatura, sem novo checkout.
    if (
      subscription?.provider === 'STRIPE' &&
      subscription.providerSubscriptionId &&
      ['ACTIVE', 'TRIAL'].includes(subscription.status)
    ) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscription.providerSubscriptionId)
        const itemId = stripeSub.items.data[0]?.id
        if (!itemId) throw new Error('Assinatura sem item de cobrança no Stripe.')
        const priceId = await this.resolvePriceId(stripe, target)

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
          metadata: { ...stripeSub.metadata, plan: targetPlanCode, tenantId },
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
    const successUrl = `${this.getAppBaseUrl()}/app/billing?upgraded=1`
    const cancelUrl = `${this.getAppBaseUrl()}/app/billing?canceled=1`
    try {
      const priceId = await this.resolvePriceId(stripe, target)
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer: subscription?.providerCustomerId || undefined,
          customer_email: subscription?.providerCustomerId ? undefined : adminEmail,
          payment_method_collection: 'always',
          metadata: { kind: 'plan_change', tenantId, plan: targetPlanCode },
          subscription_data: { metadata: { kind: 'plan_change', tenantId, plan: targetPlanCode } },
          line_items: [{ price: priceId, quantity: 1 }]
        },
        { timeout: 15000, maxNetworkRetries: 0 }
      )
      if (!session.url) throw new ServiceUnavailableException('Falha ao gerar link de pagamento.')
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
        return this.onSubscriptionUpdated(event.data.object as StripeSubscription)
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
    const status: SubscriptionStatus = stripeSubscription
      ? this.toInternalSubscriptionStatus(stripeSubscription.status)
      : session.payment_status === 'paid'
        ? 'ACTIVE'
        : 'TRIAL'
    const currentPeriodEnd = this.stripeSubscriptionPeriodEnd(stripeSubscription)
    const lastPaymentAt = session.payment_status === 'paid' ? now : null
    const cancelAtPeriodEnd = Boolean(stripeSubscription?.cancel_at_period_end)

    const subscription = await this.master.subscription.upsert({
      where: { tenantId: tenant.id },
      update: {
        plan: intent.plan,
        status,
        priceCents: intent.priceCents,
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
    const stripeSubscription = await this.retrieveStripeSubscription(providerSubscriptionId)
    const status: SubscriptionStatus = stripeSubscription
      ? this.toInternalSubscriptionStatus(stripeSubscription.status)
      : session.payment_status === 'paid'
        ? 'ACTIVE'
        : 'TRIAL'
    const currentPeriodEnd = this.stripeSubscriptionPeriodEnd(stripeSubscription)
    const lastPaymentAt = session.payment_status === 'paid' ? now : null
    const cancelAtPeriodEnd = Boolean(stripeSubscription?.cancel_at_period_end)

    await this.master.subscription.upsert({
      where: { tenantId },
      update: {
        plan,
        status,
        priceCents: catalog.priceCents,
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

    await this.master.subscription.update({
      where: { id: subscription.id },
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

    await this.master.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'PAST_DUE'
      }
    })

    try {
      const adminEmail = await this.master.loginIdentity.findFirst({
        where: { tenantId: subscription.tenantId },
        orderBy: { createdAt: 'asc' }
      })
      if (adminEmail?.email) {
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

    await this.master.subscription.update({
      where: { id: subscription.id },
      data: {
        ...(mappedPlan && mappedCatalog
          ? { plan: mappedPlan, priceCents: mappedCatalog.priceCents, currency: mappedCatalog.currency }
          : {}),
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
        return_url: `${this.getAppBaseUrl()}/app/billing`
      })
      return { redirect: session.url }
    } catch (error) {
      this.log.error({ err: error }, 'failed to create Stripe customer portal session')
      throw new ServiceUnavailableException('Não foi possível abrir o portal de pagamento agora.')
    }
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
