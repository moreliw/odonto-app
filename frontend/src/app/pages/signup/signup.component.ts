import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ActivatedRoute, RouterLink } from '@angular/router'

type Plan = {
  code: 'FREE' | 'BASIC' | 'PRO' | 'CLINIC'
  name: string
  priceCents: number
  currency: string
  description: string
  features: string[]
}

@Component({
    selector: 'app-signup',
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <div class="signup-flow">
      <div class="signup-panel card">
        <div class="signup-panel-head">
          <span class="landing-chip">Cadastro + pagamento automático</span>
          <h1>Crie sua clínica e ative sua assinatura</h1>
          <p>Após o pagamento aprovado, seu acesso é liberado automaticamente.</p>
        </div>

        @if (message) {
          <div
            class="signup-alert"
            [style.background]="success ? 'var(--success-bg)' : 'var(--danger-bg)'"
            [style.color]="success ? 'var(--success-text)' : 'var(--danger-text)'"
          >
            {{ message }}
          </div>
        }

        <form class="form" (ngSubmit)="submit()">
          <div class="form-group">
            <label>Nome da clínica *</label>
            <input class="input" [(ngModel)]="clinicName" name="clinicName" placeholder="Ex.: Clínica Sorriso Ideal" required />
          </div>

          <div class="grid cols-2">
            <div class="form-group">
              <label>Nome do responsável *</label>
              <input class="input" [(ngModel)]="adminName" name="adminName" placeholder="Ex.: Dra. Ana Souza" required />
            </div>
            <div class="form-group">
              <label>Subdomínio (opcional)</label>
              <input class="input" [(ngModel)]="subdomain" name="subdomain" placeholder="sorriso-ideal" />
            </div>
          </div>

          <div class="form-group">
            <label>E-mail do administrador *</label>
            <input class="input" [(ngModel)]="adminEmail" name="adminEmail" type="email" placeholder="admin@clinica.com" required />
          </div>

          <div class="grid cols-2">
            <div class="form-group">
              <label>Senha *</label>
              <div class="input-wrapper">
                <input
                  class="input"
                  [(ngModel)]="adminPassword"
                  name="adminPassword"
                  [type]="showPwd ? 'text' : 'password'"
                  minlength="8"
                  required
                  style="padding-right:42px;"
                  placeholder="Mínimo 8 caracteres"
                />
                <button type="button" class="input-action" (click)="showPwd = !showPwd" [attr.aria-label]="showPwd ? 'Ocultar senha' : 'Mostrar senha'">
                  @if (showPwd) {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  } @else {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>Confirmar senha *</label>
              <div class="input-wrapper">
                <input
                  class="input"
                  [(ngModel)]="adminPasswordConfirm"
                  name="adminPasswordConfirm"
                  [type]="showPwd ? 'text' : 'password'"
                  minlength="8"
                  required
                  style="padding-right:42px;"
                  placeholder="Repita a senha"
                />
              </div>
              @if (adminPasswordConfirm && adminPassword !== adminPasswordConfirm) {
                <small style="color:var(--danger-text);">As senhas não coincidem.</small>
              }
            </div>
          </div>

          <div class="form-group">
            <label>Plano *</label>
            <div class="signup-plans">
              @for (p of plans; track p.code) {
                <button
                  type="button"
                  class="signup-plan-option"
                  [class.active]="plan === p.code"
                  (click)="plan = p.code"
                >
                  <strong>{{ p.name }}</strong>
                  <span class="price">R$ {{ (p.priceCents / 100) | number:'1.2-2' }}/mês</span>
                  <small>{{ p.description }}</small>
                </button>
              }
            </div>
          </div>

          <div class="signup-footer-actions">
            <a routerLink="/" class="btn btn-ghost">Voltar</a>
            <button class="btn btn-primary" [disabled]="saving" type="submit">
              @if (saving) { <span class="spinner"></span> Redirecionando para pagamento... }
              @else { Continuar para pagamento }
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class SignupComponent implements OnInit {
  clinicName = ''
  adminName = ''
  subdomain = ''
  adminEmail = ''
  adminPassword = ''
  adminPasswordConfirm = ''
  showPwd = false
  plan: 'FREE' | 'BASIC' | 'PRO' | 'CLINIC' = 'BASIC'
  /** Fallback exibido só se /api/public/plans falhar. Espelha o PLAN_CATALOG do backend. */
  plans: Plan[] = [
    {
      code: 'BASIC',
      name: 'Essencial',
      priceCents: 12900,
      currency: 'BRL',
      description: 'Para profissionais autônomos e consultórios menores.',
      features: []
    },
    {
      code: 'PRO',
      name: 'Profissional',
      priceCents: 27900,
      currency: 'BRL',
      description: 'Para consultórios e clínicas que trabalham com equipe.',
      features: []
    },
    {
      code: 'CLINIC',
      name: 'Clínica',
      priceCents: 44900,
      currency: 'BRL',
      description: 'Para clínicas com vários profissionais e volume alto de atendimento.',
      features: []
    }
  ]
  saving = false
  success = false
  message = ''

  constructor(private readonly http: HttpClient, private readonly route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      if (params.get('canceled') === '1') {
        this.success = false
        this.message = 'Pagamento não concluído. Você pode tentar novamente.'
      }
    })
    this.http.get<Plan[]>('/api/public/plans').subscribe({
      next: plans => {
        if (Array.isArray(plans) && plans.length) this.plans = plans
      },
      error: () => {
        this.success = false
        this.message = 'Não foi possível carregar os planos agora. Exibindo valores padrão.'
      }
    })
  }

  submit() {
    this.message = ''
    if (this.adminPassword !== this.adminPasswordConfirm) {
      this.success = false
      this.message = 'As senhas não coincidem.'
      return
    }
    this.saving = true
    this.http
      .post<{ checkoutUrl: string }>('/api/public/billing/checkout-session', {
        clinicName: this.clinicName.trim(),
        adminName: this.adminName.trim(),
        subdomain: this.subdomain.trim() || undefined,
        adminEmail: this.adminEmail.trim(),
        adminPassword: this.adminPassword,
        plan: this.plan
      })
      .subscribe({
        next: res => {
          this.saving = false
          this.success = true
          if (res.checkoutUrl) {
            location.href = res.checkoutUrl
            return
          }
          this.message = 'Checkout criado, mas não foi possível redirecionar automaticamente.'
        },
        error: err => {
          this.saving = false
          this.success = false
          const msg = err.error?.message
          const asText = typeof err?.error === 'string' ? err.error : ''
          if (err?.status === 502 || /502 Bad Gateway/i.test(asText)) {
            this.message = 'Serviço de pagamento indisponível (502). Verifique se o backend está online e tente novamente.'
            return
          }
          this.message = Array.isArray(msg) ? msg.join(' ') : msg || 'Falha ao iniciar o pagamento.'
        }
      })
  }
}
