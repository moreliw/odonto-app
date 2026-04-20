import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'

@Component({
  selector: 'app-master-finance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-page">
      <div class="table-title-row">
        <div>
          <h1 style="margin:0;font-size:22px;">Financeiro</h1>
          <p class="muted" style="margin:6px 0 0;">Assinaturas, MRR e histórico recente por empresa</p>
        </div>
        <button type="button" class="btn btn-outline" (click)="load()">Atualizar</button>
      </div>

      <div class="grid cols-3 mt-4" *ngIf="summary">
        <article class="card kpi-card">
          <p class="kpi-title">MRR</p>
          <p class="kpi-value">R$ {{ ((summary.totals.mrrCents || 0) / 100) | number : '1.2-2' }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">ARR estimado</p>
          <p class="kpi-value">R$ {{ ((summary.totals.arrCents || 0) / 100) | number : '1.2-2' }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Empresas cobradas (ativa+trial)</p>
          <p class="kpi-value">{{ summary.totals.activeClinics }}</p>
        </article>
      </div>

      <section class="card mt-4">
        <h2>Por empresa</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Subdomínio</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Valor</th>
              <th>MRR</th>
              <th>Início</th>
              <th>Renovação</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of clinics">
              <td><strong>{{ row.name }}</strong></td>
              <td>{{ row.subdomain }}</td>
              <td>{{ row.plan }}</td>
              <td>
                <span class="status-chip" [class.pending]="row.status === 'TRIAL'" [class.late]="row.status === 'PAST_DUE'">{{ row.status }}</span>
              </td>
              <td>R$ {{ (row.priceCents / 100) | number : '1.2-2' }} {{ row.currency }}</td>
              <td>{{ row.countsForMrr ? 'Sim' : 'Não' }}</td>
              <td>{{ row.startedAt | date : 'shortDate' }}</td>
              <td>{{ row.renewsAt ? (row.renewsAt | date : 'short') : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card mt-4" *ngIf="summary?.recentSubscriptions?.length">
        <h2>Assinaturas recentes</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Valor</th>
              <th>Início</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of summary.recentSubscriptions">
              <td>{{ s.tenant?.name }}</td>
              <td>{{ s.plan }}</td>
              <td>{{ s.status }}</td>
              <td>R$ {{ (s.priceCents / 100) | number : '1.2-2' }} {{ s.currency }}</td>
              <td>{{ s.startedAt | date : 'short' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  `
})
export class MasterFinanceComponent implements OnInit {
  summary: any = null
  clinics: any[] = []

  constructor(private readonly http: HttpClient) {}

  ngOnInit() {
    this.load()
  }

  load() {
    this.http.get<any>('/api/master/finance/summary').subscribe(res => (this.summary = res))
    this.http.get<any[]>('/api/master/finance/clinics').subscribe(res => (this.clinics = res))
  }
}
