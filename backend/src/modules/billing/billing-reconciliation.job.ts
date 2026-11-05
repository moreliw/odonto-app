import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import Stripe = require('stripe')
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { SubscriptionStatus } from '@prisma/client-master'
import { PLAN_CATALOG } from './billing.service'

/** Repairs missed/out-of-order webhook delivery. No charges or mutations in Stripe. */
@Injectable()
export class BillingReconciliationJob implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>
  private running = false
  private readonly log = new Logger(BillingReconciliationJob.name)
  constructor(private readonly master: MasterPrismaService) {}
  onModuleInit() {
    if (!process.env.STRIPE_SECRET_KEY || process.env.BILLING_RECONCILIATION_ENABLED === 'false') return
    this.timer = setInterval(() => { void this.tick() }, 300_000)
    this.timer.unref()
    void this.tick()
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer) }
  async tick() {
    if (this.running) return
    const key = process.env.STRIPE_SECRET_KEY?.trim()
    if (!key) return
    const expected = process.env.STRIPE_EXPECTED_LIVEMODE
    if (expected && key.startsWith('sk_live_') !== (expected === 'true')) return
    this.running = true
    const stripe = new Stripe(key, { timeout: 15_000, maxNetworkRetries: 1 })
    try {
      const rows = await this.master.subscription.findMany({ where: { provider: 'STRIPE', providerSubscriptionId: { not: null } } })
      for (const row of rows) {
        try {
          const remote = await stripe.subscriptions.retrieve(row.providerSubscriptionId!)
          const status: SubscriptionStatus = remote.status === 'trialing' ? 'TRIAL' : remote.status === 'active' ? 'ACTIVE' : ['canceled','incomplete_expired'].includes(remote.status) ? 'CANCELED' : 'PAST_DUE'
          const period = (remote as any).current_period_end || remote.items.data[0]?.current_period_end || remote.trial_end
          const end = period ? new Date(period * 1000) : row.currentPeriodEnd
          const price = remote.items.data[0]?.price
          const interval = price?.recurring?.interval === 'year' ? 'YEAR' : 'MONTH'
          const catalog = Object.values(PLAN_CATALOG).find(p => p.code !== 'FREE' && price?.currency === 'brl' && price?.unit_amount === (interval === 'YEAR' ? p.annualPriceCents : p.priceCents))
          await this.master.subscription.updateMany({ where: { id: row.id, providerSubscriptionId: row.providerSubscriptionId }, data: {
            ...(catalog ? { plan: catalog.code, priceCents: interval === 'YEAR' ? catalog.annualPriceCents : catalog.priceCents, billingInterval: interval, currency: catalog.currency } : {}),
            status, currentPeriodEnd: end, renewsAt: end, cancelAtPeriodEnd: remote.cancel_at_period_end,
            canceledAt: status === 'CANCELED' ? new Date((remote.canceled_at || Math.floor(Date.now() / 1000)) * 1000) : null
          } })
        } catch { this.log.warn(`Não foi possível reconciliar a assinatura ${row.id}; nova tentativa no próximo ciclo.`) }
      }
    } catch { this.log.warn('A reconciliação periódica de assinaturas está indisponível.') }
    finally { this.running = false }
  }
}
