import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ActivatedRoute, RouterLink } from '@angular/router'

type Plan = {
  code: 'BASIC' | 'PRO'
  name: string
  priceCents: number
  currency: string
  description: string
  features: string[]
}

@Component({
  selector: 'app-signup',
  standalone: true,
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

          <div class="grid cols-2">
            <div class="form-group">
              <label>E-mail do administrador *</label>
              <input class="input" [(ngModel)]="adminEmail" name="adminEmail" type="email" placeholder="admin@clinica.com" required />
            </div>
            <div class="form-group">
              <label>Senha *</label>
              <input class="input" [(ngModel)]="adminPassword" name="adminPassword" type="password" minlength="8" required />
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
  plan: 'BASIC' | 'PRO' = 'BASIC'
  plans: Plan[] = [
    {
      code: 'BASIC',
      name: 'Basic',
      priceCents: 12900,
      currency: 'BRL',
      description: 'Ideal para clínicas em crescimento.',
      features: []
    },
    {
      code: 'PRO',
      name: 'Pro',
      priceCents: 27900,
      currency: 'BRL',
      description: 'Operação completa para escalar.',
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
