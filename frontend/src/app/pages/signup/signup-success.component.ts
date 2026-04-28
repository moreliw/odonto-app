import { Component, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { ActivatedRoute, RouterLink } from '@angular/router'

type SessionStatusResponse = {
  clinicName: string
  plan: 'BASIC' | 'PRO'
  subdomain: string
  onboardingStatus: 'PENDING' | 'PROCESSING' | 'PROVISIONED' | 'FAILED' | 'EXPIRED' | 'CANCELED'
  subscriptionStatus: 'PENDING' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
  loginAllowed: boolean
  message: string
  payment?: { checkoutStatus?: string | null; paymentStatus?: string | null }
}

@Component({
  selector: 'app-signup-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="signup-success-page">
      <div class="signup-success-card card">
        <h1>Estamos finalizando seu onboarding</h1>
        <p class="muted">Validamos o pagamento e provisionamos sua clínica automaticamente.</p>

        @if (loading) {
          <div class="signup-success-loading">
            <span class="spinner spinner-dark"></span>
            <span>Confirmando status da assinatura...</span>
          </div>
        }

        @if (error) {
          <div class="signup-alert" style="background:var(--danger-bg);color:var(--danger-text);">
            {{ error }}
          </div>
        }

        @if (status) {
          <div class="signup-success-grid">
            <div><span>Clínica</span><strong>{{ status.clinicName }}</strong></div>
            <div><span>Plano</span><strong>{{ status.plan }}</strong></div>
            <div><span>Subdomínio</span><strong>{{ status.subdomain }}</strong></div>
            <div><span>Assinatura</span><strong>{{ status.subscriptionStatus }}</strong></div>
          </div>

          <div class="signup-alert" [style.background]="status.loginAllowed ? 'var(--success-bg)' : 'var(--warning-bg)'"
            [style.color]="status.loginAllowed ? 'var(--success-text)' : 'var(--warning-text)'">
            {{ status.message }}
          </div>
        }

        <div class="signup-footer-actions">
          <a routerLink="/" class="btn btn-ghost">Voltar para o site</a>
          <a routerLink="/signup" class="btn btn-outline">Novo cadastro</a>
          <a routerLink="/login" class="btn btn-primary">Ir para login</a>
        </div>
      </div>
    </div>
  `
})
export class SignupSuccessComponent implements OnInit, OnDestroy {
  loading = true
  error = ''
  status: SessionStatusResponse | null = null
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private pollAttempts = 0
  private readonly maxAttempts = 15
  private sessionId = ''

  constructor(private readonly route: ActivatedRoute, private readonly http: HttpClient) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      this.sessionId = params.get('session_id') || ''
      if (!this.sessionId) {
        this.loading = false
        this.error = 'Sessão de checkout não encontrada. Refaça o cadastro.'
        return
      }
      this.pollAttempts = 0
      this.fetchStatus()
    })
  }

  ngOnDestroy() {
    if (this.pollTimer) clearTimeout(this.pollTimer)
  }

  private fetchStatus() {
    this.loading = true
    this.http.get<SessionStatusResponse>(`/api/public/billing/session/${encodeURIComponent(this.sessionId)}`).subscribe({
      next: res => {
        this.loading = false
        this.error = ''
        this.status = res
        const shouldContinue =
          res.onboardingStatus === 'PENDING' || res.onboardingStatus === 'PROCESSING'
        if (shouldContinue && this.pollAttempts < this.maxAttempts) {
          this.pollAttempts += 1
          this.pollTimer = setTimeout(() => this.fetchStatus(), 3000)
        }
      },
      error: err => {
        this.loading = false
        const msg = err.error?.message
        this.error = Array.isArray(msg) ? msg.join(' ') : msg || 'Não foi possível consultar o status da assinatura.'
      }
    })
  }
}
