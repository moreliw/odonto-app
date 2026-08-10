import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { ActivatedRoute, Router } from '@angular/router'
import { ToastService } from '../../services/toast.service'

type PlanCode = 'FREE' | 'BASIC' | 'PRO' | 'CLINIC'
type PublicPlan = { code: PlanCode; name: string; priceCents: number; currency: string; description: string; features: string[] }
type Subscription = {
  plan: PlanCode
  planLabel: string
  priceCents: number
  billingInterval: 'MONTH' | 'YEAR'
  status: 'PENDING' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
  provider: 'STRIPE' | null
  renewsAt: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
  cancelAtPeriodEnd: boolean
  dentistLimit: number | null
  dentistUsed: number
  managedByPlatform?: boolean
  accessGrant?: {
    plan: PlanCode
    dentistLimit: number | null
    reason: string | null
    expiresAt: string | null
  } | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  TRIAL: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento em atraso',
  CANCELED: 'Cancelada'
}
const STATUS_CLASS: Record<string, string> = {
  PENDING: 'neutral',
  TRIAL: 'blue',
  ACTIVE: '',
  PAST_DUE: 'pending',
  CANCELED: 'late'
}

@Component({
    selector: 'app-billing',
    imports: [CommonModule],
    template: `
    <div class="billing-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Plano e assinatura</h1>
          <p>Gerencie o plano da sua clínica e a forma de cobrança</p>
        </div>
      </div>

      @if (confirming) {
        <div class="card" style="display:flex;align-items:center;gap:10px;padding:14px 16px;margin-bottom:16px;">
          <span class="spinner spinner-dark"></span>
          <span>Confirmando o pagamento da assinatura...</span>
        </div>
      }
      @if (info) {
        <div class="card" style="background:var(--warning-bg);color:var(--warning-text);border-color:transparent;padding:14px 16px;margin-bottom:16px;">{{ info }}</div>
      }
      @if (error) {
        <div class="card" style="background:var(--danger-bg);color:var(--danger-text);border-color:transparent;padding:14px 16px;margin-bottom:16px;">{{ error }}</div>
      }

      @if (loading && !subscription) {
        <div class="card skeleton" style="height:120px;margin-bottom:16px;"></div>
      } @else if (subscription) {
        <div class="card billing-current">
          <div class="billing-current-info">
            <span class="muted text-sm">Plano atual</span>
            <strong>{{ subscription.plan === 'FREE' ? 'Teste Gratuito (interno)' : subscription.planLabel }}</strong>
            @if (subscription.managedByPlatform) {
              <span class="badge badge-success">Benefício da plataforma</span>
            } @else {
              <span class="status-chip" [class]="STATUS_CLASS[subscription.status]">{{ STATUS_LABEL[subscription.status] || subscription.status }}</span>
            }
          </div>
          <div class="billing-current-meta">
            @if (subscription.managedByPlatform) {
              <div><span class="muted text-sm">Cobrança</span><strong>Sem mensalidade</strong></div>
              <div>
                <span class="muted text-sm">Validade</span>
                <strong>{{ subscription.accessGrant?.expiresAt ? (subscription.accessGrant?.expiresAt | date:'dd/MM/yyyy') : 'Vitalício' }}</strong>
              </div>
            } @else if (subscription.priceCents > 0) {
              <div><span class="muted text-sm">Valor</span><strong>R$ {{ (subscription.priceCents / 100).toFixed(2) }}{{ subscription.billingInterval === 'YEAR' ? '/ano' : '/mês' }}</strong></div>
            }
            @if (subscription.currentPeriodEnd) {
              <div>
                <span class="muted text-sm">{{ subscription.cancelAtPeriodEnd ? 'Acesso até' : subscription.status === 'TRIAL' ? 'Teste até' : 'Renova em' }}</span>
                <strong>{{ subscription.currentPeriodEnd | date:'dd/MM/yyyy' }}</strong>
              </div>
            }
            @if (subscription.canceledAt) {
              <div><span class="muted text-sm">Cancelada em</span><strong>{{ subscription.canceledAt | date:'dd/MM/yyyy' }}</strong></div>
            }
          </div>
          @if (subscription.provider === 'STRIPE' && !subscription.managedByPlatform) {
            <div class="billing-current-actions">
              <button class="btn btn-outline" [disabled]="processingAction" (click)="openPortal()">
                Gerenciar pagamento e faturas
              </button>
              @if ((subscription.status === 'ACTIVE' || subscription.status === 'TRIAL') && !subscription.cancelAtPeriodEnd) {
                <button class="btn btn-ghost billing-cancel" [disabled]="processingAction" (click)="cancelRenewal()">
                  Cancelar renovação
                </button>
              }
            </div>
          }
          @if (subscription.cancelAtPeriodEnd) {
            <p class="billing-cancel-notice">A renovação está cancelada. Você continua com acesso até o fim do período indicado.</p>
          }
          @if (subscription.managedByPlatform) {
            <p class="billing-managed-notice">
              Este acesso foi concedido diretamente pela administração do OdontoApp{{ subscription.accessGrant?.reason ? ': ' + subscription.accessGrant?.reason : '.' }}
              Alterações de plano e cobrança são tratadas pelo suporte enquanto o benefício estiver ativo.
            </p>
          }
        </div>

        <div class="card team-quota">
          <div class="team-quota-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="team-quota-text">
            <strong>{{ subscription.dentistUsed }}{{ subscription.dentistLimit !== null ? ' de ' + subscription.dentistLimit : '' }} dentista{{ (subscription.dentistLimit ?? subscription.dentistUsed) === 1 ? '' : 's' }}</strong>
            <span>usados no plano atual{{ subscription.dentistLimit === null ? ' — sem limite' : '' }}.</span>
          </div>
          @if (subscription.dentistLimit !== null) {
            <div class="team-quota-bar"><span [style.width.%]="(subscription.dentistUsed / subscription.dentistLimit) * 100"></span></div>
          }
        </div>
      }

      <h2 class="billing-section-title">Planos disponíveis</h2>
      @if (plans.length) {
        <div class="billing-plan-grid">
          @for (p of plans; track p.code) {
            <article class="billing-plan-card" [class.is-current]="subscription?.plan === p.code">
              @if (p.code === 'PRO') { <span class="billing-plan-badge">Mais escolhido</span> }
              <h3>{{ p.name }}</h3>
              <p class="muted text-sm">{{ p.description }}</p>
              <p class="billing-plan-price"><strong>R$ {{ (p.priceCents / 100).toFixed(2) }}</strong><span class="muted">/mês</span></p>
              <ul class="billing-plan-features">
                @for (f of p.features; track f) {
                  <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>{{ f }}</li>
                }
              </ul>
              @if (isCurrentActivePlan(p.code)) {
                <button class="btn btn-outline btn-block" disabled>Plano atual</button>
              } @else if (subscription?.managedByPlatform) {
                <button class="btn btn-outline btn-block" disabled>Gerenciado pela plataforma</button>
              } @else {
                <button class="btn btn-primary btn-block" [disabled]="changing === p.code" (click)="changeTo(p.code)">
                  @if (changing === p.code) { <span class="spinner"></span> }
                  {{ subscription?.plan === p.code ? 'Reativar assinatura' : isDowngrade(p.code) ? 'Mudar para este plano' : 'Fazer upgrade' }}
                </button>
              }
            </article>
          }
        </div>
      }
    </div>
  `
})
export class BillingComponent implements OnInit {
  subscription: Subscription | null = null
  plans: PublicPlan[] = []
  loading = false
  confirming = false
  changing: PlanCode | null = null
  processingAction = false
  info = ''
  error = ''

  readonly STATUS_LABEL = STATUS_LABEL
  readonly STATUS_CLASS = STATUS_CLASS
  private readonly planOrder: PlanCode[] = ['BASIC', 'PRO', 'CLINIC']

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly toast: ToastService
  ) {}

  ngOnInit() {
    if (typeof sessionStorage !== 'undefined') {
      const blockedMessage = sessionStorage.getItem('authBlockedMessage')
      if (blockedMessage) {
        this.info = blockedMessage
        sessionStorage.removeItem('authBlockedMessage')
      }
    }
    this.http.get<PublicPlan[]>('/api/public/plans').subscribe({
      next: res => { this.plans = res.filter(p => p.code !== 'FREE').sort((a, b) => this.planOrder.indexOf(a.code) - this.planOrder.indexOf(b.code)) }
    })

    this.route.queryParamMap.subscribe(params => {
      if (params.get('canceled') === '1') {
        this.info = 'A troca de plano foi cancelada. Nada foi alterado.'
        this.clearQueryParams()
      }
      if (params.get('upgraded') === '1') {
        this.confirming = true
        this.clearQueryParams()
        this.pollAfterCheckout()
      }
    })

    this.load()
  }

  private clearQueryParams() {
    this.router.navigate([], { queryParams: {}, replaceUrl: true })
  }

  private pollAfterCheckout(attempt = 0) {
    this.http.get<Subscription>('/api/billing/subscription').subscribe({
      next: res => {
        const settled = res.provider === 'STRIPE' && (res.status === 'ACTIVE' || res.status === 'TRIAL')
        this.subscription = res
        if (settled || attempt >= 6) {
          this.confirming = false
          if (settled) this.toast.success('Plano atualizado com sucesso')
          return
        }
        setTimeout(() => this.pollAfterCheckout(attempt + 1), 2000)
      },
      error: () => { this.confirming = false }
    })
  }

  isDowngrade(target: PlanCode) {
    if (!this.subscription) return false
    if (this.subscription.plan === 'FREE') return false
    return this.planOrder.indexOf(target) < this.planOrder.indexOf(this.subscription.plan)
  }

  isCurrentActivePlan(target: PlanCode) {
    return this.subscription?.plan === target &&
      (this.subscription.status === 'ACTIVE' || this.subscription.status === 'TRIAL') &&
      !this.subscription.cancelAtPeriodEnd
  }

  load() {
    this.loading = true
    this.error = ''
    this.http.get<Subscription>('/api/billing/subscription').subscribe({
      next: res => { this.loading = false; this.subscription = res },
      error: () => { this.loading = false; this.error = 'Não foi possível carregar sua assinatura agora.' }
    })
  }

  changeTo(plan: PlanCode) {
    this.error = ''
    this.changing = plan
    this.http.post<{ ok?: boolean; redirect?: string; message?: string }>('/api/billing/change-plan', { plan }).subscribe({
      next: res => {
        if (res.redirect) {
          location.href = res.redirect
          return
        }
        this.changing = null
        this.toast.success(res.message || 'Plano atualizado')
        this.load()
      },
      error: (err: any) => {
        this.changing = null
        const msg = err.error?.message
        this.error = Array.isArray(msg) ? msg.join(' ') : msg || 'Não foi possível trocar de plano agora.'
      }
    })
  }

  openPortal() {
    this.error = ''
    this.processingAction = true
    this.http.post<{ redirect: string }>('/api/billing/portal', {}).subscribe({
      next: res => {
        if (res.redirect) location.href = res.redirect
        else this.processingAction = false
      },
      error: (err: any) => {
        this.processingAction = false
        this.error = err.error?.message || 'Não foi possível abrir o portal de pagamento.'
      }
    })
  }

  cancelRenewal() {
    const confirmed = window.confirm('Cancelar a renovação? Seu acesso continuará ativo até o fim do período já contratado.')
    if (!confirmed) return
    this.error = ''
    this.processingAction = true
    this.http.post<{ ok: boolean; message: string }>('/api/billing/cancel', {}).subscribe({
      next: res => {
        this.processingAction = false
        this.toast.success(res.message || 'Renovação cancelada')
        this.load()
      },
      error: (err: any) => {
        this.processingAction = false
        this.error = err.error?.message || 'Não foi possível cancelar a renovação agora.'
      }
    })
  }
}
