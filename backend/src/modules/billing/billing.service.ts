import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common'
import { Prisma, Plan, SignupIntentStatus, SubscriptionStatus } from '@prisma/client-master'
import Stripe = require('stripe')
import * as argon2 from 'argon2'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { TenantProvisionService } from '../tenancy/tenant-provision.service'
import { MailerService } from '../mailer/mailer.service'

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

const PLAN_CATALOG: Record<Plan, PlanPublicInfo> = {
  BASIC: {
    code: 'BASIC',
    name: 'Basic',
    priceCents: 4900,
    currency: 'BRL',
    description: 'Perfeito para clínicas em crescimento.',
    features: ['Agenda e pacientes', 'Prontuário digital', 'Suporte por e-mail']
  },
  PRO: {
    code: 'PRO',
    name: 'Pro',
    priceCents: 9900,
    currency: 'BRL',
    description: 'Gestão completa para clínicas com maior volume.',
    features: ['Tudo do Basic', 'Operação multiusuário', 'Dashboard operacional avançado']
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

  constructor(
    private readonly master: MasterPrismaService,
    private readonly provision: TenantProvisionService,
    private readonly mailer: MailerService
  ) {}

  getPublicPlans() {
    return Object.values(PLAN_CATALOG)
  }

  private getStripeClient() {
    if (this.stripeClient !== undefined) return this.stripeClient
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
    if (!secretKey) {
      this.stripeClient = null
      return this.stripeClient
    }
    this.stripeClient = new Stripe(secretKey)
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
    const stripe = this.getStripeClient()
    if (!stripe) throw new ServiceUnavailableException('Pagamentos temporariamente indisponíveis.')

    const plan = PLAN_CATALOG[input.plan]
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

    const successUrl = `${this.getAppBaseUrl()}/signup/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${this.getAppBaseUrl()}/signup?canceled=1`
    const configuredPriceId =
      plan.code === 'PRO'
        ? process.env.STRIPE_PRICE_PRO_MONTHLY?.trim()
        : process.env.STRIPE_PRICE_BASIC_MONTHLY?.trim()

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        client_reference_id: intent.id,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: adminEmail,
        metadata: {
          intentId: intent.id,
          clinicSlug: clinicSlug.slice(0, 40),
          plan: plan.code
        },
        subscription_data: {
          metadata: {
            intentId: intent.id,
            clinicSlug: clinicSlug.slice(0, 40),
            plan: plan.code
          }
        },
        line_items: configuredPriceId
          ? [{ price: configuredPriceId, quantity: 1 }]
          : [
              {
                quantity: 1,
                price_data: {
                  currency: plan.currency.toLowerCase(),
                  unit_amount: plan.priceCents,
                  recurring: { interval: 'month' },
                  product_data: {
                    name: `Odonto SaaS ${plan.name}`,
                    description: plan.description
                  }
                }
              }
            ]
      })

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
      throw new ServiceUnavailableException('Não foi possível iniciar o pagamento agora. Tente novamente.')
    }
  }

  async getCheckoutSessionStatus(sessionId: string) {
    const intent = await this.master.signupIntent.findFirst({
      where: { providerSessionId: sessionId },
      include: { tenant: { include: { subscription: true } } }
    })
    if (!intent) throw new NotFoundException('Sessão de checkout não encontrada.')

    const stripe = this.getStripeClient()
    let stripeSessionStatus: string | null = null
    let stripePaymentStatus: string | null = null

    if (stripe && intent.providerSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(intent.providerSessionId)
        stripeSessionStatus = session.status || null
        stripePaymentStatus = session.payment_status || null
      } catch (error) {
        this.log.warn(`failed to read stripe session ${intent.providerSessionId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const subscriptionStatus = intent.tenant?.subscription?.status || 'PENDING'
    return {
      intentId: intent.id,
      clinicName: intent.clinicName,
      plan: intent.plan,
      subdomain: intent.tenant?.subdomain || intent.requestedSubdomain,
      onboardingStatus: intent.status,
      subscriptionStatus,
      loginAllowed: subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIAL',
      message:
        intent.status === 'PROVISIONED'
          ? 'Sua clínica foi ativada com sucesso. Você já pode fazer login.'
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

    const existing = await this.master.paymentEvent.findUnique({
      where: { externalEventId: event.id }
    })
    if (existing) return { received: true, duplicate: true }

      const eventRow = await this.master.paymentEvent.create({
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
    const intent = await this.findIntentBySession(session)
    if (!intent) {
      this.log.warn(`signup intent not found for checkout session ${session.id}`)
      return { tenantId: null, signupIntentId: null }
    }

    await this.master.signupIntent.update({
      where: { id: intent.id },
      data: {
        providerSessionId: session.id,
        providerCustomerId: typeof session.customer === 'string' ? session.customer : intent.providerCustomerId,
        providerSubscriptionId: typeof session.subscription === 'string' ? session.subscription : intent.providerSubscriptionId
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
        paidAt: new Date()
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
    const currentPeriodEnd = (() => {
      const d = new Date(now)
      d.setMonth(d.getMonth() + 1)
      return d
    })()

    const subscription = await this.master.subscription.upsert({
      where: { tenantId: tenant.id },
      update: {
        plan: intent.plan,
        status: 'ACTIVE',
        priceCents: intent.priceCents,
        currency: intent.currency,
        provider: 'STRIPE',
        providerCustomerId: typeof session.customer === 'string' ? session.customer : intent.providerCustomerId,
        providerSubscriptionId: typeof session.subscription === 'string' ? session.subscription : intent.providerSubscriptionId,
        activatedAt: now,
        lastPaymentAt: now,
        currentPeriodEnd,
        renewsAt: currentPeriodEnd,
        canceledAt: null
      },
      create: {
        tenantId: tenant.id,
        plan: intent.plan,
        status: 'ACTIVE',
        priceCents: intent.priceCents,
        currency: intent.currency,
        provider: 'STRIPE',
        providerCustomerId: typeof session.customer === 'string' ? session.customer : intent.providerCustomerId,
        providerSubscriptionId: typeof session.subscription === 'string' ? session.subscription : intent.providerSubscriptionId,
        startedAt: now,
        activatedAt: now,
        lastPaymentAt: now,
        currentPeriodEnd,
        renewsAt: currentPeriodEnd
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

  private async onInvoicePaid(invoice: StripeInvoice) {
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null
    if (!subscriptionId) return { tenantId: null, signupIntentId: null }

    const subscription = await this.master.subscription.findFirst({
      where: { providerSubscriptionId: subscriptionId },
      include: { tenant: true }
    })
    if (!subscription) return { tenantId: null, signupIntentId: null }

    const periodEndFromLine = invoice.lines.data[0]?.period?.end
    const currentPeriodEnd = asIsoOrNull(periodEndFromLine) || subscription.currentPeriodEnd || null

    await this.master.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        lastPaymentAt: new Date(),
        currentPeriodEnd,
        renewsAt: currentPeriodEnd
      }
    })

    return { tenantId: subscription.tenantId, signupIntentId: null }
  }

  private async onInvoicePaymentFailed(invoice: StripeInvoice) {
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null
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

    await this.master.subscription.update({
      where: { id: subscription.id },
      data: {
        status,
        currentPeriodEnd: currentPeriodEnd || subscription.currentPeriodEnd,
        renewsAt: currentPeriodEnd || subscription.renewsAt,
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
