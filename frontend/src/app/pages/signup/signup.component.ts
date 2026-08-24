import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ActivatedRoute, RouterLink } from '@angular/router'

type Plan = {
  code: 'FREE' | 'BASIC' | 'PRO' | 'CLINIC'
  name: string
  priceCents: number
  annualPriceCents: number
  currency: string
  description: string
  features: string[]
  /** Limite de dentistas do plano (`null` = ilimitado). Vem do backend junto do catálogo. */
  dentistLimit?: number | null
  limitLabel?: string
}

type FieldName = 'clinicName' | 'adminName' | 'adminEmail' | 'adminPassword' | 'adminPasswordConfirm'

/** Id do input de cada campo — usado para focar o primeiro erro depois de um submit inválido. */
const FIELD_INPUT_IDS: Record<FieldName, string> = {
  clinicName: 'clinic-name',
  adminName: 'admin-name',
  adminEmail: 'admin-email',
  adminPassword: 'admin-password',
  adminPasswordConfirm: 'admin-password-confirm'
}

/** Ordem em que os campos aparecem no formulário — define qual erro recebe o foco. */
const FIELD_ORDER: FieldName[] = ['clinicName', 'adminName', 'adminEmail', 'adminPassword', 'adminPasswordConfirm']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

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

            <form class="signup-form" (ngSubmit)="submit()" novalidate>
              <div class="login-field signup-field--full" [class.is-invalid]="showError('clinicName')">
                <label for="clinic-name">Nome da clínica</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 21h18M5 21V5l7-3 7 3v16M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4" />
                  </svg>
                  <input
                    id="clinic-name" [(ngModel)]="clinicName" name="clinicName" placeholder="Ex.: Clínica Sorriso Ideal"
                    autocomplete="organization"
                    [attr.aria-invalid]="showError('clinicName') || null"
                    [attr.aria-describedby]="showError('clinicName') ? 'err-clinicName' : null"
                    (blur)="onBlur('clinicName')" (ngModelChange)="onFieldChange('clinicName')"
                  />
                </div>
                @if (showError('clinicName')) { <small class="signup-field-error" id="err-clinicName">{{ fieldErrors.clinicName }}</small> }
              </div>

              <div class="login-field" [class.is-invalid]="showError('adminName')">
                <label for="admin-name">Nome do responsável</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>
                  <input
                    id="admin-name" [(ngModel)]="adminName" name="adminName" placeholder="Ex.: Dra. Ana Souza" autocomplete="name"
                    [attr.aria-invalid]="showError('adminName') || null"
                    [attr.aria-describedby]="showError('adminName') ? 'err-adminName' : null"
                    (blur)="onBlur('adminName')" (ngModelChange)="onFieldChange('adminName')"
                  />
                </div>
                @if (showError('adminName')) { <small class="signup-field-error" id="err-adminName">{{ fieldErrors.adminName }}</small> }
              </div>

              <div class="login-field" [class.is-invalid]="showError('adminEmail')">
                <label for="admin-email">E-mail do administrador</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  <input
                    id="admin-email" [(ngModel)]="adminEmail" name="adminEmail" type="email" placeholder="admin@clinica.com"
                    autocomplete="email" autocapitalize="none" spellcheck="false"
                    [attr.aria-invalid]="showError('adminEmail') || null"
                    [attr.aria-describedby]="showError('adminEmail') ? 'err-adminEmail' : null"
                    (blur)="onBlur('adminEmail')" (ngModelChange)="onFieldChange('adminEmail')"
                  />
                </div>
                @if (showError('adminEmail')) { <small class="signup-field-error" id="err-adminEmail">{{ fieldErrors.adminEmail }}</small> }
                @else { <small class="signup-field-hint">É com este e-mail que você vai entrar no sistema.</small> }
              </div>

              <div class="login-field" [class.is-invalid]="showError('adminPassword')">
                <label for="admin-password">Senha</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    id="admin-password" [(ngModel)]="adminPassword" name="adminPassword" [type]="showPwd ? 'text' : 'password'"
                    placeholder="Mínimo 8 caracteres" autocomplete="new-password"
                    [attr.aria-invalid]="showError('adminPassword') || null"
                    [attr.aria-describedby]="showError('adminPassword') ? 'err-adminPassword' : null"
                    (blur)="onBlur('adminPassword')" (ngModelChange)="onFieldChange('adminPassword')"
                  />
                  <button type="button" class="login-password-action" (click)="showPwd = !showPwd" [attr.aria-label]="showPwd ? 'Ocultar senha' : 'Mostrar senha'" [attr.aria-pressed]="showPwd">
                    @if (showPwd) {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M1 1l22 22" /></svg>
                    } @else {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                    }
                  </button>
                </div>
                @if (showError('adminPassword')) { <small class="signup-field-error" id="err-adminPassword">{{ fieldErrors.adminPassword }}</small> }
              </div>

              <div class="login-field" [class.is-invalid]="showError('adminPasswordConfirm')">
                <label for="admin-password-confirm">Confirmar senha</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    id="admin-password-confirm" [(ngModel)]="adminPasswordConfirm" name="adminPasswordConfirm"
                    [type]="showPasswordConfirm ? 'text' : 'password'" placeholder="Repita a senha" autocomplete="new-password"
                    [attr.aria-invalid]="showError('adminPasswordConfirm') || null"
                    [attr.aria-describedby]="showError('adminPasswordConfirm') ? 'err-adminPasswordConfirm' : null"
                    (blur)="onBlur('adminPasswordConfirm')" (ngModelChange)="onFieldChange('adminPasswordConfirm')"
                  />
                  <button type="button" class="login-password-action" (click)="showPasswordConfirm = !showPasswordConfirm" [attr.aria-label]="showPasswordConfirm ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'" [attr.aria-pressed]="showPasswordConfirm">
                    @if (showPasswordConfirm) {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M1 1l22 22" /></svg>
                    } @else {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                    }
                  </button>
                </div>
                @if (showError('adminPasswordConfirm')) { <small class="signup-field-error" id="err-adminPasswordConfirm">{{ fieldErrors.adminPasswordConfirm }}</small> }
              </div>

              <fieldset class="signup-plan-field signup-field--full">
                <legend>Escolha seu plano</legend>

                @if (!isFreePlan) {
                  <div class="signup-cycle" role="group" aria-label="Ciclo de cobrança">
                    <button type="button" class="signup-cycle-btn" [class.active]="billingInterval === 'MONTH'" [attr.aria-pressed]="billingInterval === 'MONTH'" (click)="billingInterval = 'MONTH'">Mensal</button>
                    <button type="button" class="signup-cycle-btn" [class.active]="billingInterval === 'YEAR'" [attr.aria-pressed]="billingInterval === 'YEAR'" (click)="billingInterval = 'YEAR'">Anual <span class="signup-cycle-tag">-10%</span></button>
                  </div>
                }

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
                        @else { R$ {{ formatPrice(monthlyEquivalentCents(p)) }}<small>/mês</small> }
                      </span>
                      @if (billingInterval === 'YEAR' && p.priceCents > 0) {
                        <span class="signup-plan-billed">R$ {{ formatPrice(p.annualPriceCents) }} cobrados por ano</span>
                      }
                      <span class="signup-plan-limit">{{ planLimitLabel(p) }}</span>
                    </button>
                  }
                </div>

                @if (!isFreePlan && billingInterval === 'YEAR') {
                  <p class="signup-cycle-legal">
                    Cobrança anual à vista, com 10% de desconto sobre o valor mensal. Ao cancelar, o acesso continua até o fim
                    do período já pago — sem reembolso proporcional.
                  </p>
                }
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
      annualPriceCents: 139320,
      currency: 'BRL',
      description: 'Para profissionais autônomos e consultórios menores.',
      features: [],
      dentistLimit: 1,
      limitLabel: '1 dentista'
    },
    {
      code: 'PRO',
      name: 'Profissional',
      priceCents: 27900,
      annualPriceCents: 301320,
      currency: 'BRL',
      description: 'Para consultórios e clínicas que trabalham com equipe.',
      features: [],
      dentistLimit: 3,
      limitLabel: 'Até 3 dentistas'
    },
    {
      code: 'CLINIC',
      name: 'Clínica',
      priceCents: 44900,
      annualPriceCents: 484920,
      currency: 'BRL',
      description: 'Para clínicas com vários profissionais e volume alto de atendimento.',
      features: [],
      dentistLimit: null,
      limitLabel: 'Dentistas ilimitados'
    }
  ]
  billingInterval: 'MONTH' | 'YEAR' = 'MONTH'
  saving = false
  success = false
  message = ''

  fieldErrors: Partial<Record<FieldName, string>> = {}
  private touched: Partial<Record<FieldName, boolean>> = {}
  /** Depois da primeira tentativa de envio, todos os erros aparecem — não só os dos campos já visitados. */
  private submitted = false

  get isFreePlan() {
    return this.plans.find(item => item.code === this.plan)?.priceCents === 0
  }

  formatPrice(priceCents: number) {
    return (priceCents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  /**
   * Todo card mostra o valor por mês, mesmo no ciclo anual — comparar "R$ 129/mês" com
   * "R$ 1.393,20/ano" obriga o cliente a fazer conta de cabeça. O total anual aparece
   * como linha de apoio logo abaixo.
   */
  monthlyEquivalentCents(p: Plan) {
    return this.billingInterval === 'YEAR' ? Math.round(p.annualPriceCents / 12) : p.priceCents
  }

  planLimitLabel(p: Plan) {
    if (p.limitLabel) return p.limitLabel
    if (p.dentistLimit === null) return 'Dentistas ilimitados'
    if (typeof p.dentistLimit === 'number') return p.dentistLimit === 1 ? '1 dentista' : `Até ${p.dentistLimit} dentistas`
    return p.description
  }

  constructor(private readonly http: HttpClient, private readonly route: ActivatedRoute) {}

  /* ── Validação ────────────────────────────────────────────── */

  /** Regra de cada campo. Devolve a mensagem do erro ou `null` quando está válido. */
  private ruleFor(field: FieldName): string | null {
    switch (field) {
      case 'clinicName': {
        const value = this.clinicName.trim()
        if (!value) return 'Informe o nome da clínica.'
        if (value.length < 3) return 'O nome da clínica precisa ter ao menos 3 caracteres.'
        return null
      }
      case 'adminName': {
        const value = this.adminName.trim()
        if (!value) return 'Informe o nome do responsável.'
        if (value.length < 2) return 'O nome do responsável precisa ter ao menos 2 caracteres.'
        return null
      }
      case 'adminEmail': {
        const value = this.adminEmail.trim()
        if (!value) return 'Informe o e-mail do administrador.'
        if (!EMAIL_RE.test(value)) return 'Informe um e-mail válido — por exemplo, nome@clinica.com.'
        return null
      }
      case 'adminPassword': {
        if (!this.adminPassword) return 'Crie uma senha de acesso.'
        if (this.adminPassword.length < 8) return 'A senha precisa ter ao menos 8 caracteres.'
        return null
      }
      case 'adminPasswordConfirm': {
        if (!this.adminPasswordConfirm) return 'Repita a senha para confirmar.'
        if (this.adminPasswordConfirm !== this.adminPassword) return 'As senhas não coincidem.'
        return null
      }
    }
  }

  private setFieldError(field: FieldName, message: string | null) {
    if (message) this.fieldErrors[field] = message
    else delete this.fieldErrors[field]
  }

  showError(field: FieldName) {
    return Boolean(this.fieldErrors[field]) && (this.submitted || this.touched[field] === true)
  }

  onBlur(field: FieldName) {
    this.touched[field] = true
    this.setFieldError(field, this.ruleFor(field))
  }

  onFieldChange(field: FieldName) {
    // Enquanto digita, o erro só é reavaliado se o campo já falhou uma vez — assim a
    // mensagem some no instante em que o valor fica correto, sem acusar erro cedo demais.
    if (this.submitted || this.touched[field]) this.setFieldError(field, this.ruleFor(field))
    // Confirmar a senha depende da senha: mudar uma revalida a outra.
    if (field === 'adminPassword' && (this.submitted || this.touched.adminPasswordConfirm)) {
      this.setFieldError('adminPasswordConfirm', this.ruleFor('adminPasswordConfirm'))
    }
    if (this.message && !this.success) this.message = ''
  }

  /** Revalida tudo e devolve o primeiro campo inválido, ou `null` se o formulário está pronto. */
  private firstInvalidField(): FieldName | null {
    let first: FieldName | null = null
    for (const field of FIELD_ORDER) {
      const error = this.ruleFor(field)
      this.setFieldError(field, error)
      if (error && !first) first = field
    }
    return first
  }

  private focusField(field: FieldName) {
    const input = document.getElementById(FIELD_INPUT_IDS[field]) as HTMLInputElement | null
    input?.focus()
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  /** Erros vindos do backend (`{ errors: { campo: mensagem } }`) aplicados aos campos correspondentes. */
  private applyServerErrors(errors: unknown): FieldName | null {
    if (!errors || typeof errors !== 'object') return null
    let first: FieldName | null = null
    for (const field of FIELD_ORDER) {
      const message = (errors as Record<string, unknown>)[field]
      if (typeof message === 'string' && message) {
        this.setFieldError(field, message)
        if (!first) first = field
      }
    }
    return first
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      if (params.get('canceled') === '1') {
        this.success = false
        this.message = 'Pagamento não concluído. Você pode tentar novamente.'
      }
      const planParam = params.get('plan')
      if (planParam && ['FREE', 'BASIC', 'PRO', 'CLINIC'].includes(planParam)) {
        this.plan = planParam as Plan['code']
      }
      if (params.get('cycle') === 'annual') this.billingInterval = 'YEAR'
    })
    this.http.get<Plan[]>('/api/public/plans').subscribe({
      next: plans => {
        if (!Array.isArray(plans) || !plans.length) return
        this.plans = plans
        // `?plan=` pode apontar para um plano que este ambiente não vende (ex.: FREE fora
        // do interno). Sem essa reconciliação o cartão fica sem seleção visível e o
        // checkout só falharia no backend.
        if (!plans.some(p => p.code === this.plan)) this.plan = plans[0].code
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
    this.submitted = true

    const invalid = this.firstInvalidField()
    if (invalid) {
      this.success = false
      const count = Object.keys(this.fieldErrors).length
      this.message =
        count === 1
          ? this.fieldErrors[invalid] || 'Revise o formulário para continuar.'
          : `Revise ${count} campos destacados para continuar.`
      this.focusField(invalid)
      return
    }

    this.saving = true
    this.http
      .post<{ checkoutUrl: string }>('/api/public/billing/checkout-session', {
        clinicName: this.clinicName.trim(),
        adminName: this.adminName.trim(),
        adminEmail: this.adminEmail.trim(),
        adminPassword: this.adminPassword,
        plan: this.plan,
        billingInterval: this.isFreePlan ? 'MONTH' : this.billingInterval
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

          const serverField = this.applyServerErrors(err?.error?.errors)
          if (serverField) this.focusField(serverField)

          const msg = err.error?.message
          const asText = typeof err?.error === 'string' ? err.error : ''
          if (err?.status === 0) {
            this.message = 'Não conseguimos falar com o servidor. Verifique sua conexão e tente novamente.'
            return
          }
          if (err?.status === 429) {
            this.message = 'Muitas tentativas seguidas. Aguarde um minuto e tente novamente.'
            return
          }
          if (err?.status === 502 || err?.status === 503 || /502 Bad Gateway/i.test(asText)) {
            this.message =
              (typeof msg === 'string' && msg) ||
              'Serviço de pagamento indisponível no momento. Tente novamente em instantes.'
            return
          }
          this.message = Array.isArray(msg) ? msg.join(' ') : msg || 'Falha ao iniciar o pagamento.'
        }
      })
  }
}
