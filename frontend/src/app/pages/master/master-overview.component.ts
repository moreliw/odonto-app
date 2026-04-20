import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { RouterLink } from '@angular/router'

@Component({
  selector: 'app-master-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="dashboard-page">
      <div class="table-title-row">
        <div>
          <h1 style="margin:0;font-size:22px;">Visão geral</h1>
          <p class="muted" style="margin:6px 0 0;">Indicadores globais e cadastro rápido de empresas</p>
        </div>
        <a routerLink="/admin/empresas" class="btn btn-outline">Gerenciar empresas</a>
      </div>

      <div class="grid cols-4 mt-4">
        <article class="card kpi-card">
          <p class="kpi-title">Empresas</p>
          <p class="kpi-value">{{ finance?.totals?.clinics ?? '—' }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Ativas / trial</p>
          <p class="kpi-value">{{ finance?.totals?.activeClinics ?? '—' }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">MRR</p>
          <p class="kpi-value">R$ {{ ((finance?.totals?.mrrCents || 0) / 100) | number : '1.2-2' }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">ARR (est.)</p>
          <p class="kpi-value">R$ {{ ((finance?.totals?.arrCents || 0) / 100) | number : '1.2-2' }}</p>
        </article>
      </div>

      <div class="grid cols-4 mt-4">
        <article class="card kpi-card">
          <p class="kpi-title">Pacientes (todos tenants)</p>
          <p class="kpi-value">{{ ops?.totals?.patients ?? '—' }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Agendamentos</p>
          <p class="kpi-value">{{ ops?.totals?.appointments ?? '—' }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Usuários clínicas</p>
          <p class="kpi-value">{{ ops?.totals?.users ?? '—' }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Faturas (soma R$)</p>
          <p class="kpi-value">R$ {{ ops?.totals?.invoicesAmountSum || '0.00' }}</p>
        </article>
      </div>

      <div class="grid cols-2 mt-4">
        <article class="card">
          <h2>Nova empresa</h2>
          <p class="muted">Provisiona banco isolado, assinatura e administrador inicial.</p>
          <form class="form mt-3" (ngSubmit)="createClinic()">
            <input class="input" [(ngModel)]="form.name" name="name" placeholder="Nome da empresa" required />
            <input class="input" [(ngModel)]="form.subdomain" name="subdomain" placeholder="Subdomínio (opcional)" />
            <input class="input" [(ngModel)]="form.adminEmail" name="adminEmail" type="email" placeholder="E-mail do admin" required />
            <input class="input" [(ngModel)]="form.adminPassword" name="adminPassword" type="password" placeholder="Senha inicial" required />
            <div class="grid cols-2">
              <select class="select" [(ngModel)]="form.plan" name="plan">
                <option value="BASIC">BASIC</option>
                <option value="PRO">PRO</option>
              </select>
              <input class="input" [(ngModel)]="form.priceCents" name="priceCents" type="number" min="1000" step="100" placeholder="Preço (centavos)" required />
            </div>
            <button class="btn btn-primary" [disabled]="saving" type="submit">{{ saving ? 'Criando…' : 'Criar empresa' }}</button>
            <p *ngIf="message" class="muted mt-2">{{ message }}</p>
          </form>
        </article>
        <article class="card">
          <h2>Resumo de assinaturas</h2>
          <table class="table">
            <tbody>
              <tr><th>Plano BASIC</th><td>{{ finance?.byPlan?.BASIC || 0 }}</td></tr>
              <tr><th>Plano PRO</th><td>{{ finance?.byPlan?.PRO || 0 }}</td></tr>
              <tr><th>Ativas</th><td>{{ finance?.byStatus?.ACTIVE || 0 }}</td></tr>
              <tr><th>Trial</th><td>{{ finance?.byStatus?.TRIAL || 0 }}</td></tr>
              <tr><th>Em atraso</th><td>{{ finance?.byStatus?.PAST_DUE || 0 }}</td></tr>
              <tr><th>Canceladas</th><td>{{ finance?.byStatus?.CANCELED || 0 }}</td></tr>
            </tbody>
          </table>
          <a routerLink="/admin/financeiro" class="btn btn-outline mt-3" style="width:100%">Abrir financeiro detalhado</a>
        </article>
      </div>
    </div>
  `
})
export class MasterOverviewComponent implements OnInit {
  finance: any = null
  ops: any = null
  message = ''
  saving = false
  form = {
    name: '',
    subdomain: '',
    adminEmail: '',
    adminPassword: '',
    plan: 'BASIC',
    priceCents: 4900
  }

  constructor(private readonly http: HttpClient) {}

  ngOnInit() {
    this.load()
  }

  load() {
    this.http.get<any>('/api/master/finance/summary').subscribe(res => (this.finance = res))
    this.http.get<any>('/api/master/operations/overview').subscribe(res => (this.ops = res))
  }

  createClinic() {
    this.message = ''
    this.saving = true
    this.http.post('/api/master/clinics', this.form).subscribe({
      next: () => {
        this.saving = false
        this.message = 'Empresa criada com banco isolado.'
        this.form = { name: '', subdomain: '', adminEmail: '', adminPassword: '', plan: 'BASIC', priceCents: 4900 }
        this.load()
      },
      error: err => {
        this.saving = false
        this.message = err.error?.message || 'Erro ao criar empresa'
      }
    })
  }
}
