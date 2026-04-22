import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'

const STATUS_CLASS: Record<string, string> = { ACTIVE: '', TRIAL: 'pending', PAST_DUE: 'late', CANCELED: 'neutral' }

@Component({
  selector: 'app-master-finance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Financeiro</h1>
          <p>MRR, ARR e histórico de assinaturas por empresa</p>
        </div>
        <div class="page-header-actions">
          <button type="button" class="btn btn-outline btn-sm" (click)="load()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Atualizar
          </button>
        </div>
      </div>

      @if (summary) {
        <div class="grid cols-3">
          <article class="card kpi-card">
            <div class="kpi-icon" style="background:var(--success-bg);color:var(--success-text);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <span class="kpi-title">MRR</span>
            <strong class="kpi-value">R$ {{ ((summary.totals.mrrCents || 0) / 100) | number:'1.0-0' }}</strong>
            <span class="kpi-delta">Receita mensal recorrente</span>
          </article>
          <article class="card kpi-card">
            <div class="kpi-icon" style="background:var(--warning-bg);color:var(--warning-text);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 7 13.5 15.5 8.5 10.5 2 17"/></svg>
            </div>
            <span class="kpi-title">ARR estimado</span>
            <strong class="kpi-value">R$ {{ ((summary.totals.arrCents || 0) / 100) | number:'1.0-0' }}</strong>
            <span class="kpi-delta">MRR × 12 meses</span>
          </article>
          <article class="card kpi-card">
            <div class="kpi-icon" style="background:var(--primary-50);color:var(--primary);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            </div>
            <span class="kpi-title">Empresas cobradas</span>
            <strong class="kpi-value">{{ summary.totals.activeClinics }}</strong>
            <span class="kpi-delta">Ativas + trial</span>
          </article>
        </div>
      }

      <div class="card" style="padding:0;overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
          <h2 style="margin:0;">Assinaturas por empresa</h2>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Subdomínio</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Conta p/ MRR</th>
                <th>Início</th>
                <th>Renovação</th>
              </tr>
            </thead>
            <tbody>
              @if (clinics.length === 0) {
                <tr><td colspan="8" class="table-empty">Nenhuma assinatura encontrada</td></tr>
              }
              @for (row of clinics; track row.id) {
                <tr>
                  <td><strong>{{ row.name }}</strong></td>
                  <td class="muted text-sm">{{ row.subdomain }}</td>
                  <td>
                    <span class="badge" [class.badge-blue]="row.plan === 'PRO'" [class.badge-neutral]="row.plan !== 'PRO'">{{ row.plan }}</span>
                  </td>
                  <td>
                    <span class="status-chip" [class]="STATUS_CLASS[row.status] || ''">{{ row.status }}</span>
                  </td>
                  <td class="text-sm">R$ {{ (row.priceCents / 100) | number:'1.2-2' }} {{ row.currency }}</td>
                  <td>
                    <span class="badge" [class.badge-success]="row.countsForMrr" [class.badge-neutral]="!row.countsForMrr">
                      {{ row.countsForMrr ? 'Sim' : 'Não' }}
                    </span>
                  </td>
                  <td class="muted text-sm">{{ row.startedAt | date:'dd/MM/yyyy' }}</td>
                  <td class="muted text-sm">{{ row.renewsAt ? (row.renewsAt | date:'dd/MM/yyyy') : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (summary?.recentSubscriptions?.length) {
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
            <h2 style="margin:0;">Assinaturas recentes</h2>
          </div>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr><th>Empresa</th><th>Plano</th><th>Status</th><th>Valor</th><th>Início</th></tr>
              </thead>
              <tbody>
                @for (s of summary.recentSubscriptions; track s.id) {
                  <tr>
                    <td><strong>{{ s.tenant?.name }}</strong></td>
                    <td>{{ s.plan }}</td>
                    <td><span class="status-chip" [class]="STATUS_CLASS[s.status] || ''">{{ s.status }}</span></td>
                    <td>R$ {{ (s.priceCents / 100) | number:'1.2-2' }} {{ s.currency }}</td>
                    <td class="muted text-sm">{{ s.startedAt | date:'dd/MM/yyyy' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `
})
export class MasterFinanceComponent implements OnInit {
  summary: any = null
  clinics: any[] = []
  readonly STATUS_CLASS = STATUS_CLASS

  constructor(private readonly http: HttpClient) {}

  ngOnInit() { this.load() }

  load() {
    this.http.get<any>('/api/master/finance/summary').subscribe((res: any) => this.summary = res)
    this.http.get<any[]>('/api/master/finance/clinics').subscribe((res: any[]) => this.clinics = res)
  }
}
