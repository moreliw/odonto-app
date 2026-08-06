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
    <main class="login-page signup-page">
      <section class="login-showcase signup-showcase" aria-label="OdontoApp">
        <div class="login-showcase-grid" aria-hidden="true"></div>

        <a class="login-brand login-brand--light" routerLink="/" aria-label="OdontoApp — ir para a página inicial">
          <span class="login-brand-icon">
            <img src="assets/logo-mark-96.png" width="46" height="46" alt="" />
          </span>
          <span class="login-brand-name">Odonto<span>App</span></span>
        </a>

        <div class="login-showcase-content">
          <h1>
            Comece uma rotina mais leve.<br />
            <span>Sua clínica em um só lugar.</span>
          </h1>
          <p>Configure seu acesso e deixe o OdontoApp cuidar da organização com você.</p>
        </div>
      </section>

      <section class="login-access signup-access" aria-labelledby="signup-title">
        <div class="login-access-top">
          <a routerLink="/" class="login-back-link">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Voltar ao site
          </a>
        </div>

        <div class="login-access-inner signup-access-inner">
          <a class="login-brand login-brand--mobile" routerLink="/" aria-label="OdontoApp — ir para a página inicial">
            <span class="login-brand-icon">
              <img src="assets/logo-mark-96.png" width="44" height="44" alt="" />
            </span>
            <span class="login-brand-name">Odonto<span>App</span></span>
          </a>

          <div class="login-card signup-card">
            <header class="login-card-header signup-card-header">
              <span class="login-card-eyebrow">Nova clínica</span>
              <h2 id="signup-title">Crie sua clínica</h2>
              <p>Preencha os dados abaixo para configurar seu acesso.</p>
            </header>

            @if (message) {
              <div class="login-error signup-alert" [class.signup-alert--success]="success" role="alert" aria-live="polite">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  @if (success) {
                    <path d="M20 6 9 17l-5-5" />
                  } @else {
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16h.01" />
                  }
                </svg>
                <span>{{ message }}</span>
              </div>
            }

            <form class="signup-form" (ngSubmit)="submit()">
              <div class="login-field signup-field--full">
                <label for="clinic-name">Nome da clínica</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 21h18M5 21V5l7-3 7 3v16M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4" />
                  </svg>
                  <input id="clinic-name" [(ngModel)]="clinicName" name="clinicName" placeholder="Ex.: Clínica Sorriso Ideal" autocomplete="organization" required />
                </div>
              </div>

              <div class="login-field">
                <label for="admin-name">Nome do responsável</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>
                  <input id="admin-name" [(ngModel)]="adminName" name="adminName" placeholder="Ex.: Dra. Ana Souza" autocomplete="name" required />
                </div>
              </div>

              <div class="login-field">
                <label for="admin-email">E-mail do administrador</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  <input id="admin-email" [(ngModel)]="adminEmail" name="adminEmail" type="email" placeholder="admin@clinica.com" autocomplete="email" autocapitalize="none" spellcheck="false" required />
                </div>
              </div>

              <div class="login-field">
                <label for="admin-password">Senha</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input id="admin-password" [(ngModel)]="adminPassword" name="adminPassword" [type]="showPwd ? 'text' : 'password'" minlength="8" placeholder="Mínimo 8 caracteres" autocomplete="new-password" required />
                  <button type="button" class="login-password-action" (click)="showPwd = !showPwd" [attr.aria-label]="showPwd ? 'Ocultar senha' : 'Mostrar senha'" [attr.aria-pressed]="showPwd">
                    @if (showPwd) {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M1 1l22 22" /></svg>
                    } @else {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                    }
                  </button>
                </div>
              </div>

              <div class="login-field">
                <label for="admin-password-confirm">Confirmar senha</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input id="admin-password-confirm" [(ngModel)]="adminPasswordConfirm" name="adminPasswordConfirm" [type]="showPasswordConfirm ? 'text' : 'password'" minlength="8" placeholder="Repita a senha" autocomplete="new-password" required />
                  <button type="button" class="login-password-action" (click)="showPasswordConfirm = !showPasswordConfirm" [attr.aria-label]="showPasswordConfirm ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'" [attr.aria-pressed]="showPasswordConfirm">
                    @if (showPasswordConfirm) {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M1 1l22 22" /></svg>
                    } @else {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                    }
                  </button>
                </div>
                @if (adminPasswordConfirm && adminPassword !== adminPasswordConfirm) {
                  <small class="signup-password-error">As senhas não coincidem.</small>
                }
              </div>

              <fieldset class="signup-plan-field signup-field--full">
                <legend>Escolha seu plano</legend>
                <div class="signup-plans" [class.signup-plans--four]="plans.length >= 4" role="radiogroup" aria-label="Plano da clínica">
                  @for (p of plans; track p.code) {
                    <button type="button" class="signup-plan-option" [class.active]="plan === p.code" role="radio" [attr.aria-checked]="plan === p.code" (click)="plan = p.code">
                      <span class="signup-plan-head">
                        <strong>{{ p.name }}</strong>
                        <span class="signup-plan-check" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 4 4L19 6" /></svg>
                        </span>
                      </span>
                      <span class="price">
                        @if (p.priceCents === 0) { Gratuito }
                        @else { R$ {{ formatPrice(p.priceCents) }}<small>/mês</small> }
                      </span>
                      <span class="signup-plan-description">{{ p.description }}</span>
                    </button>
                  }
                </div>
              </fieldset>

              <button class="login-submit signup-submit signup-field--full" [disabled]="saving" type="submit">
                @if (saving) {
                  <span class="login-spinner" aria-hidden="true"></span>
                  {{ isFreePlan ? 'Criando sua clínica...' : 'Preparando pagamento...' }}
                } @else {
                  <span>{{ isFreePlan ? 'Criar minha clínica' : 'Continuar para pagamento' }}</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                }
              </button>
            </form>
          </div>

          <div class="login-signup signup-login-link">
            <div>
              <strong>Já possui uma clínica?</strong>
              <span>Acesse sua conta existente.</span>
            </div>
            <a routerLink="/login">
              Fazer login
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </div>
        </div>
      </section>
    </main>
  `,
  styleUrls: ['../login/login.component.css', './signup.component.css']
})
export class SignupComponent implements OnInit {
  clinicName = ''
  adminName = ''
  adminEmail = ''
  adminPassword = ''
  adminPasswordConfirm = ''
  showPwd = false
  showPasswordConfirm = false
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

  get isFreePlan() {
    return this.plans.find(item => item.code === this.plan)?.priceCents === 0
  }

  formatPrice(priceCents: number) {
    return (priceCents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

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
    if (this.saving) return
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
