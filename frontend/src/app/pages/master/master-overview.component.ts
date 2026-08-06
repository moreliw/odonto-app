import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { RouterLink } from '@angular/router'
import { ToastService } from '../../services/toast.service'

type MasterPlan = 'FREE' | 'BASIC' | 'PRO' | 'CLINIC'

const PLAN_PRICE_BRL: Record<MasterPlan, number> = {
  FREE: 0,
  BASIC: 129,
  PRO: 279,
  CLINIC: 449
}

@Component({
    selector: 'app-master-overview',
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Visão geral</h1>
          <p>Indicadores globais da plataforma em tempo real</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-outline btn-sm" (click)="load()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Atualizar
          </button>
          <a routerLink="/admin/empresas" class="btn btn-primary btn-sm">Gerenciar empresas</a>
        </div>
      </div>

      <!-- Finance KPIs -->
      <div class="grid cols-4">
        <article class="card kpi-card">
          <div class="kpi-icon" style="background:var(--primary-50);color:var(--primary);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          </div>
          <span class="kpi-title">Empresas</span>
          <strong class="kpi-value">{{ finance?.totals?.clinics ?? '—' }}</strong>
          <span class="kpi-delta">{{ finance?.totals?.activeClinics ?? 0 }} ativas · {{ finance?.totals?.complimentaryClinics ?? 0 }} com benefício</span>
        </article>
        <article class="card kpi-card">
          <div class="kpi-icon" style="background:var(--success-bg);color:var(--success-text);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span class="kpi-title">MRR</span>
          <strong class="kpi-value">R$ {{ ((finance?.totals?.mrrCents || 0) / 100) | number:'1.0-0' }}</strong>
          <span class="kpi-delta">Receita mensal recorrente</span>
        </article>
        <article class="card kpi-card">
          <div class="kpi-icon" style="background:var(--warning-bg);color:var(--warning-text);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <span class="kpi-title">ARR estimado</span>
          <strong class="kpi-value">R$ {{ ((finance?.totals?.arrCents || 0) / 100) | number:'1.0-0' }}</strong>
          <span class="kpi-delta">Receita anual projetada</span>
        </article>
        <article class="card kpi-card">
          <div class="kpi-icon" style="background:#f3e8ff;color:#7c3aed;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span class="kpi-title">Pacientes (todos tenants)</span>
          <strong class="kpi-value">{{ ops?.totals?.patients ?? '—' }}</strong>
          <span class="kpi-delta">{{ ops?.totals?.appointments ?? 0 }} agendamentos</span>
        </article>
      </div>

      <div class="grid cols-2">
        <!-- New Clinic Form -->
        <article class="card">
          <h2>Nova empresa</h2>
          <p class="muted text-sm" style="margin-bottom:16px;">Provisiona banco isolado, assinatura e administrador inicial.</p>
          <form class="form" (ngSubmit)="createClinic()">
            <div class="form-group">
              <label>Nome da empresa *</label>
              <input class="input" [(ngModel)]="form.name" name="name" placeholder="Nome da clínica" required />
            </div>
            <div class="form-group">
              <label>Subdomínio <span class="muted" style="font-weight:400;">(opcional)</span></label>
              <input class="input" [(ngModel)]="form.subdomain" name="subdomain" placeholder="clinica-nome" />
            </div>
            <div class="form-group">
              <label>E-mail do admin *</label>
              <input class="input" [(ngModel)]="form.adminEmail" name="adminEmail" type="email" required />
            </div>
            <div class="grid cols-2">
              <div class="form-group">
                <label>Senha inicial *</label>
                <div class="input-wrapper">
                  <input class="input" [(ngModel)]="form.adminPassword" name="adminPassword" [type]="showCreatePassword ? 'text' : 'password'" minlength="8" required style="padding-right:42px;" />
                  <button type="button" class="input-action" (click)="showCreatePassword = !showCreatePassword" [attr.aria-label]="showCreatePassword ? 'Ocultar senha' : 'Mostrar senha'">
                    @if (showCreatePassword) {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    } @else {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label>Confirmar senha *</label>
                <div class="input-wrapper">
                  <input class="input" [(ngModel)]="form.adminPasswordConfirm" name="adminPasswordConfirm" [type]="showCreatePasswordConfirm ? 'text' : 'password'" minlength="8" required style="padding-right:42px;" />
                  <button type="button" class="input-action" (click)="showCreatePasswordConfirm = !showCreatePasswordConfirm" [attr.aria-label]="showCreatePasswordConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'">
                    @if (showCreatePasswordConfirm) {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    } @else {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                @if (form.adminPasswordConfirm && form.adminPassword !== form.adminPasswordConfirm) {
                  <small style="color:var(--danger-text);">As senhas não coincidem.</small>
                }
              </div>
            </div>
            <div class="grid cols-2">
              <div class="form-group">
                <label>Plano</label>
                <select class="select" [(ngModel)]="form.plan" name="plan" (ngModelChange)="onPlanChange($event)">
                  <option value="FREE">FREE (Teste interno)</option>
                  <option value="BASIC">BASIC (Essencial)</option>
                  <option value="PRO">PRO (Profissional)</option>
                  <option value="CLINIC">CLINIC (Clínica)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Mensalidade (R$)</label>
                <input class="input" [(ngModel)]="form.priceMonthlyBrl" name="priceMonthlyBrl" type="number" min="0" step="0.01" />
              </div>
            </div>
            @if (createMessage) {
              <div style="padding:10px 12px;border-radius:8px;font-size:13px;"
                [style.background]="createSuccess ? 'var(--success-bg)' : 'var(--danger-bg)'"
                [style.color]="createSuccess ? 'var(--success-text)' : 'var(--danger-text)'">
                {{ createMessage }}
              </div>
            }
            <button class="btn btn-primary" [disabled]="saving" type="submit">
              @if (saving) { <span class="spinner"></span> Criando... }
              @else { Criar empresa }
            </button>
          </form>
        </article>

        <!-- Subscription Summary -->
        <article class="card">
          <h2>Resumo de assinaturas</h2>
          <div style="display:grid;gap:10px;margin-bottom:20px;">
            @for (row of summaryRows; track row.label) {
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface-2);border-radius:8px;">
                <span class="text-sm" style="color:var(--text-2);">{{ row.label }}</span>
                <strong style="font-size:15px;color:var(--text);">{{ row.value }}</strong>
              </div>
            }
          </div>
          <a routerLink="/admin/financeiro" class="btn btn-outline" style="width:100%;justify-content:center;">Ver financeiro detalhado</a>
        </article>
      </div>
    </div>
  `
})
export class MasterOverviewComponent implements OnInit {
  finance: any = null
  ops: any = null
  createMessage = ''
  createSuccess = false
  saving = false
  showCreatePassword = false
  showCreatePasswordConfirm = false
  form = this.emptyForm()

  get summaryRows() {
    return [
      { label: 'Plano FREE', value: this.finance?.byPlan?.FREE || 0 },
      { label: 'Plano BASIC', value: this.finance?.byPlan?.BASIC || 0 },
      { label: 'Plano PRO', value: this.finance?.byPlan?.PRO || 0 },
      { label: 'Plano CLINIC', value: this.finance?.byPlan?.CLINIC || 0 },
      { label: 'Benefícios ativos', value: this.finance?.totals?.complimentaryClinics || 0 },
      { label: 'Pendentes', value: this.finance?.byStatus?.PENDING || 0 },
      { label: 'Ativas', value: this.finance?.byStatus?.ACTIVE || 0 },
      { label: 'Trial', value: this.finance?.byStatus?.TRIAL || 0 },
      { label: 'Em atraso', value: this.finance?.byStatus?.PAST_DUE || 0 },
      { label: 'Canceladas', value: this.finance?.byStatus?.CANCELED || 0 },
    ]
  }

  constructor(private readonly http: HttpClient, private toast: ToastService) {}

  ngOnInit() { this.load() }

  load() {
    this.http.get<any>('/api/master/finance/summary').subscribe((res: any) => this.finance = res)
    this.http.get<any>('/api/master/operations/overview').subscribe((res: any) => this.ops = res)
  }

  onPlanChange(plan: MasterPlan) {
    this.form.priceMonthlyBrl = PLAN_PRICE_BRL[plan]
  }

  createClinic() {
    this.createMessage = ''
    if (this.form.adminPassword !== this.form.adminPasswordConfirm) {
      this.createSuccess = false
      this.createMessage = 'As senhas não coincidem.'
      return
    }
    this.saving = true
    const { adminPasswordConfirm: _confirmation, ...body } = this.form
    this.http.post('/api/master/clinics', body).subscribe({
      next: () => {
        this.saving = false
        this.createSuccess = true
        this.createMessage = 'Empresa criada com banco de dados isolado.'
        this.form = this.emptyForm()
        this.showCreatePassword = false
        this.showCreatePasswordConfirm = false
        this.load()
        this.toast.success('Empresa criada com sucesso')
      },
      error: (err: any) => {
        this.saving = false
        this.createSuccess = false
        this.createMessage = err.error?.message || 'Erro ao criar empresa'
      }
    })
  }

  private emptyForm() {
    return {
      name: '',
      subdomain: '',
      adminEmail: '',
      adminPassword: '',
      adminPasswordConfirm: '',
      plan: 'BASIC' as MasterPlan,
      priceMonthlyBrl: PLAN_PRICE_BRL.BASIC
    }
  }
}
