import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'

@Component({
    selector: 'app-master-operations',
    imports: [CommonModule],
    template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Operacional</h1>
          <p>Uso agregado por empresa: pacientes, agenda, prontuários e faturas</p>
        </div>
        <div class="page-header-actions">
          <button type="button" class="btn btn-outline btn-sm" (click)="load()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Atualizar
          </button>
        </div>
      </div>

      @if (overview) {
        <div class="grid cols-3">
          @for (kpi of kpis; track kpi.label) {
            <article class="card kpi-card">
              <div class="kpi-icon" [style.background]="kpi.bg" [style.color]="kpi.color" [innerHTML]="kpi.icon"></div>
              <span class="kpi-title">{{ kpi.label }}</span>
              <strong class="kpi-value">{{ kpi.value }}</strong>
            </article>
          }
        </div>
      }

      <div class="card" style="padding:0;overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
          <h2 style="margin:0;">Uso por empresa</h2>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Subdomínio</th>
                <th>Pacientes</th>
                <th>Hoje</th>
                <th>Usuários ativos</th>
                <th>Prontuários</th>
                <th>Recebido</th>
                <th>Despesas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @if (!overview) {
                <tr><td colspan="9" class="table-empty"><span class="spinner spinner-dark"></span></td></tr>
              }
              @for (row of overview?.clinics; track row.tenantId) {
                <tr>
                  <td><strong>{{ row.name }}</strong></td>
                  <td class="muted text-sm">{{ row.subdomain }}</td>
                  <td>{{ row.stats?.patients ?? '—' }}</td>
                  <td>{{ row.stats?.appointmentsToday ?? '—' }}</td>
                  <td>{{ row.stats?.activeUsers ?? '—' }}<span class="muted text-sm"> / {{ row.stats?.users ?? '—' }}</span></td>
                  <td>{{ row.stats?.records ?? '—' }}</td>
                  <td>{{ row.stats ? money(row.stats.receivedAmountSum) : '—' }}</td>
                  <td>{{ row.stats ? money(row.stats.expensesAmountSum) : '—' }}</td>
                  <td>
                    @if (row.error) {
                      <span class="badge badge-danger">Erro</span>
                    } @else {
                      <span class="badge badge-success">OK</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class MasterOperationsComponent implements OnInit {
  overview: any = null

  get kpis() {
    const t = this.overview?.totals
    return [
      { label: 'Pacientes', value: t?.patients ?? '—', bg: 'var(--primary-50)', color: 'var(--primary)', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' },
      { label: 'Agenda de hoje', value: t?.appointmentsToday ?? '—', bg: 'var(--success-bg)', color: 'var(--success-text)', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
      { label: 'Usuários ativos', value: `${t?.activeUsers ?? '—'} / ${t?.users ?? '—'}`, bg: '#f3e8ff', color: '#7c3aed', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
      { label: 'Recebido nas clínicas', value: this.money(t?.receivedAmountSum), bg: 'var(--success-bg)', color: 'var(--success-text)', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
      { label: 'Despesas das clínicas', value: this.money(t?.expensesAmountSum), bg: 'var(--danger-bg)', color: 'var(--danger-text)', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>' },
      { label: 'Prontuários', value: t?.records ?? '—', bg: 'var(--warning-bg)', color: 'var(--warning-text)', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
    ]
  }

  constructor(private readonly http: HttpClient) {}

  money(value: string | number | undefined) {
    if (value === undefined || value === null) return '—'
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  ngOnInit() { this.load() }

  load() {
    this.http.get<any>('/api/master/operations/overview').subscribe((res: any) => this.overview = res)
  }
}
