import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { combineLatest, forkJoin } from 'rxjs'
import { catchError, of } from 'rxjs'
import { AnalyticsStore } from '../../state/analytics.store'
import { KpiCardComponent } from '../../components/analytics/kpi-card.component'
import { LineChartComponent } from '../../components/analytics/line-chart.component'
import { BarChartComponent } from '../../components/analytics/bar-chart.component'
import { DonutChartComponent } from '../../components/analytics/donut-chart.component'
import { HeatmapComponent } from '../../components/analytics/heatmap.component'
import { FilterBarComponent } from '../../components/analytics/filter-bar.component'
import { AdvancedTableComponent } from '../../components/analytics/advanced-table.component'

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardComponent,
    LineChartComponent,
    BarChartComponent,
    DonutChartComponent,
    HeatmapComponent,
    FilterBarComponent,
    AdvancedTableComponent,
  ],
  template: `
    <div class="dashboard-page">
      <!-- Page Header -->
      <div class="page-header">
        <div class="page-header-left">
          <h1>Dashboard</h1>
          <p>Visão geral da clínica · {{ today }}</p>
        </div>
        <div class="page-header-actions">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge badge-success">Dados ao vivo</span>
            <button class="btn btn-outline btn-sm" (click)="loadRealData()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <!-- Real KPIs from API (shown when loaded) -->
      @if (liveStats) {
        <div class="grid cols-4">
          <article class="card kpi-card">
            <div class="kpi-icon" style="background:var(--primary-50);color:var(--primary);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
            <span class="kpi-title">Pacientes</span>
            <strong class="kpi-value">{{ liveStats.patients }}</strong>
            <span class="kpi-delta">Total cadastrados</span>
          </article>
          <article class="card kpi-card">
            <div class="kpi-icon" style="background:var(--success-bg);color:var(--success-text);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <span class="kpi-title">Consultas</span>
            <strong class="kpi-value">{{ liveStats.appointments }}</strong>
            <span class="kpi-delta">{{ liveStats.scheduledAppointments }} agendadas</span>
          </article>
          <article class="card kpi-card">
            <div class="kpi-icon" style="background:var(--warning-bg);color:var(--warning-text);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <span class="kpi-title">Faturamento</span>
            <strong class="kpi-value">R$ {{ liveStats.invoiceTotal }}</strong>
            <span class="kpi-delta">{{ liveStats.pendingInvoices }} pendentes</span>
          </article>
          <article class="card kpi-card">
            <div class="kpi-icon" style="background:#f3e8ff;color:#7c3aed;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <span class="kpi-title">Prontuários</span>
            <strong class="kpi-value">{{ liveStats.records }}</strong>
            <span class="kpi-delta">Registros clínicos</span>
          </article>
        </div>
      } @else {
        <!-- Analytics KPIs (mock) -->
        <div class="grid cols-4 kpi-grid">
          <app-kpi-card *ngFor="let metric of (kpis$ | async) || []" [metric]="metric"></app-kpi-card>
        </div>
      }

      <div class="grid cols-2">
        <app-line-chart [points]="(lineSeries$ | async) || []"></app-line-chart>
        <app-bar-chart [points]="(barSeries$ | async) || []"></app-bar-chart>
      </div>

      <div class="grid cols-2">
        <app-donut-chart [slices]="(donutSeries$ | async) || []"></app-donut-chart>
        <app-heatmap [cells]="(heatmap$ | async) || []"></app-heatmap>
      </div>

      <app-filter-bar
        [search]="search"
        [status]="status"
        [pageSize]="pageSize"
        (searchChange)="onSearchChange($event)"
        (statusChange)="onStatusChange($event)"
        (pageSizeChange)="onPageSizeChange($event)"
      ></app-filter-bar>

      <app-advanced-table
        [rows]="(pagedRows$ | async) || []"
        [page]="page"
        [totalPages]="(totalPages$ | async) || 1"
        [totalRows]="(filteredRows$ | async)?.length || 0"
        (prevPage)="onPrevPage()"
        (nextPage)="onNextPage()"
      ></app-advanced-table>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly kpis$ = this.store.kpis$
  readonly lineSeries$ = this.store.lineSeries$
  readonly barSeries$ = this.store.barSeries$
  readonly donutSeries$ = this.store.donutSeries$
  readonly heatmap$ = this.store.heatmap$
  readonly filteredRows$ = this.store.filteredRows$
  readonly pagedRows$ = this.store.pagedRows$
  readonly totalPages$ = this.store.totalPages$

  search = ''
  status: 'ALL' | 'PAGO' | 'PENDENTE' | 'ATRASADO' = 'ALL'
  page = 1
  pageSize = 6
  liveStats: any = null
  today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  constructor(private readonly store: AnalyticsStore, private http: HttpClient) {
    combineLatest([this.store.page$, this.store.pageSize$, this.store.status$, this.store.search$]).subscribe(
      ([page, pageSize, status, search]: [number, number, 'ALL'|'PAGO'|'PENDENTE'|'ATRASADO', string]) => { this.page = page; this.pageSize = pageSize; this.status = status; this.search = search }
    )
  }

  ngOnInit() { this.loadRealData() }

  loadRealData() {
    forkJoin({
      patients: this.http.get<any[]>('/api/patients').pipe(catchError(() => of([]))),
      appointments: this.http.get<any[]>('/api/appointments').pipe(catchError(() => of([]))),
      invoices: this.http.get<any[]>('/api/invoices').pipe(catchError(() => of([]))),
      records: this.http.get<any[]>('/api/records/all').pipe(catchError(() => of([]))),
    }).subscribe(({ patients, appointments, invoices, records }: { patients: any[]; appointments: any[]; invoices: any[]; records: any[] }) => {
      const paidInvoices = invoices.filter((i: any) => i.status === 'PAID')
      const total = paidInvoices.reduce((acc: number, i: any) => acc + Number(i.amount || 0), 0)
      this.liveStats = {
        patients: patients.length,
        appointments: appointments.length,
        scheduledAppointments: appointments.filter((a: any) => a.status === 'SCHEDULED').length,
        invoiceTotal: total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        pendingInvoices: invoices.filter((i: any) => i.status === 'PENDING').length,
        records: records.length,
      }
    })
  }

  onSearchChange(v: string) { this.store.setSearch(v) }
  onStatusChange(v: 'ALL' | 'PAGO' | 'PENDENTE' | 'ATRASADO') { this.store.setStatus(v) }
  onPageSizeChange(v: number) { this.store.setPageSize(v) }
  onPrevPage() { this.store.setPage(this.page - 1) }
  onNextPage() { this.store.setPage(this.page + 1) }
}
