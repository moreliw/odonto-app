import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { MasterAdminService } from '../../services/master-admin.service'
import { Router } from '@angular/router'

@Component({
  selector: 'app-master-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="master-layout">
      <header class="master-header card">
        <div>
          <h2>Painel Master de Clínicas</h2>
          <p class="muted">Gestão financeira e administrativa global</p>
        </div>
        <button class="btn btn-outline" (click)="logout()">Sair</button>
      </header>

      <section class="grid cols-3">
        <article class="card">
          <p class="muted">Clínicas cadastradas</p>
          <h2>{{finance?.totals?.clinics || 0}}</h2>
        </article>
        <article class="card">
          <p class="muted">Clínicas ativas</p>
          <h2>{{finance?.totals?.activeClinics || 0}}</h2>
        </article>
        <article class="card">
          <p class="muted">MRR (mensal)</p>
          <h2>R$ {{((finance?.totals?.mrrCents || 0) / 100) | number:'1.2-2'}}</h2>
        </article>
      </section>

      <section class="grid cols-2 mt-4">
        <article class="card">
          <h2>Nova clínica (tenant isolado)</h2>
          <form class="form" (ngSubmit)="createClinic()">
            <input class="input" [(ngModel)]="form.name" name="name" placeholder="Nome da clínica" required />
            <input class="input" [(ngModel)]="form.subdomain" name="subdomain" placeholder="Subdomínio (opcional)" />
            <input class="input" [(ngModel)]="form.adminEmail" name="adminEmail" placeholder="E-mail do administrador" type="email" required />
            <input class="input" [(ngModel)]="form.adminPassword" name="adminPassword" placeholder="Senha inicial" type="password" required />
            <div class="grid cols-2">
              <select class="select" [(ngModel)]="form.plan" name="plan">
                <option value="BASIC">BASIC</option>
                <option value="PRO">PRO</option>
              </select>
              <input class="input" [(ngModel)]="form.priceCents" name="priceCents" type="number" min="1000" step="100" placeholder="Preço em centavos" required />
            </div>
            <button class="btn btn-primary" [disabled]="saving" type="submit">{{saving ? 'Criando...' : 'Criar clínica'}}</button>
            <p *ngIf="message" class="muted mt-2">{{message}}</p>
          </form>
        </article>
        <article class="card">
          <h2>Resumo financeiro</h2>
          <table class="table">
            <tbody>
              <tr><th>BASIC</th><td>{{finance?.byPlan?.BASIC || 0}}</td></tr>
              <tr><th>PRO</th><td>{{finance?.byPlan?.PRO || 0}}</td></tr>
              <tr><th>Ativas</th><td>{{finance?.byStatus?.ACTIVE || 0}}</td></tr>
              <tr><th>Em atraso</th><td>{{finance?.byStatus?.PAST_DUE || 0}}</td></tr>
              <tr><th>Canceladas</th><td>{{finance?.byStatus?.CANCELED || 0}}</td></tr>
            </tbody>
          </table>
        </article>
      </section>

      <section class="card mt-4">
        <h2>Clínicas e planos</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Clínica</th>
              <th>Subdomínio</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Preço</th>
              <th>Banco</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let clinic of clinics">
              <td>{{clinic.name}}</td>
              <td>{{clinic.subdomain}}</td>
              <td>{{clinic.subscription?.plan || 'BASIC'}}</td>
              <td>{{clinic.subscription?.status || 'ACTIVE'}}</td>
              <td>R$ {{((clinic.subscription?.priceCents || 0) / 100) | number:'1.2-2'}}</td>
              <td>{{clinic.dbName}}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  `
})
export class MasterDashboardComponent implements OnInit {
  clinics: any[] = []
  finance: any = null
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

  constructor(private readonly http: HttpClient, private readonly master: MasterAdminService, private readonly router: Router) {}

  ngOnInit() {
    this.load()
  }

  load() {
    this.http.get<any[]>('/api/master/clinics').subscribe(res => (this.clinics = res))
    this.http.get<any>('/api/master/finance/summary').subscribe(res => (this.finance = res))
  }

  createClinic() {
    this.message = ''
    this.saving = true
    this.http.post('/api/master/clinics', this.form).subscribe({
      next: () => {
        this.saving = false
        this.message = 'Clínica criada com sucesso com banco isolado por tenant.'
        this.form = { name: '', subdomain: '', adminEmail: '', adminPassword: '', plan: 'BASIC', priceCents: 4900 }
        this.load()
      },
      error: err => {
        this.saving = false
        this.message = err.error?.message || 'Erro ao criar clínica'
      }
    })
  }

  logout() {
    this.master.logout()
    this.router.navigateByUrl('/admin/login')
  }
}
