import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client-tenant'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { AiClient } from './ai-client'
import { generateWeekly } from './weekly-summary'

/** Opt-in, no email/WhatsApp dispatch. Monday snapshots appear inside the app.
 * Runs hourly and catches up after restarts; never sends patient identifiers. */
@Injectable()
export class WeeklySummaryJob implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>
  private running = false
  private readonly log = new Logger(WeeklySummaryJob.name)
  constructor(private readonly master: MasterPrismaService, private readonly ai: AiClient) {}

  onModuleInit() {
    if (process.env.AI_WEEKLY_JOB_ENABLED === 'false') return
    this.timer = setInterval(() => { void this.tick() }, 3600_000)
    this.timer.unref()
    void this.tick()
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer) }

  async tick() {
    if (this.running || !this.ai.configuration().enabled) return
    this.running = true
    try {
      const tenants = await this.master.tenant.findMany({ where: { active: true }, include: { subscription: true, accessGrant: true } })
      for (const tenant of tenants) {
        const grant = tenant.accessGrant
        const granted = grant?.active && (!grant.expiresAt || grant.expiresAt > new Date())
        if (!granted && !['ACTIVE', 'TRIAL'].includes(tenant.subscription?.status || '')) continue
        const url = new URL(process.env.MASTER_DATABASE_URL!)
        url.pathname = `/${tenant.dbName}`
        url.searchParams.set('connection_limit', '1')
        const db = new PrismaClient({ datasources: { db: { url: url.toString() } } })
        try {
          if (!(await db.aiSettings.findUnique({ where: { id: 'default' } }))?.weeklyEnabled) continue
          await generateWeekly(db, this.ai)
        } catch {
          // Do not log patient data, provider responses or connection strings.
          this.log.warn(`Resumo semanal indisponível para a clínica ${tenant.id}; nova tentativa no próximo ciclo.`)
        } finally { await db.$disconnect() }
      }
    } catch { this.log.warn('Não foi possível consultar as clínicas para o resumo semanal.') }
    finally { this.running = false }
  }
}
