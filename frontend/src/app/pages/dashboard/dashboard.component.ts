import { Component, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Router, RouterLink } from '@angular/router'
import { Subscription } from 'rxjs'
import { KpiCardComponent } from '../../components/analytics/kpi-card.component'
import { LineChartComponent } from '../../components/analytics/line-chart.component'
import { DonutChartComponent } from '../../components/analytics/donut-chart.component'
import { AuthService } from '../../services/auth.service'
import { PrivacyService } from '../../services/privacy.service'
import { ChartPoint, DonutSlice, KpiMetric } from '../../models/analytics.model'

type TodayAppointment = { id: string; patientName: string; dentistName?: string | null; startTime: string; endTime: string; status: string }

type DashboardMetrics = {
  patientCount: number
  appointmentsToday: number
  appointmentsNextSevenDays: number
  pendingConfirmations: number
  unassignedAppointments: number
  completedThisMonth: number
  newPatientsThisMonth: number
  canViewFinancial: boolean
  revenueThisMonth: number
  invoicesStatus: { pending: number; partial: number; paid: number; cancelled: number }
  monthlyPatients: { label: string; count: number }[]
  todayAppointments: TodayAppointment[]
}

type MyMetrics = {
  appointmentsToday: number
  appointmentsThisWeek: number
  completedThisMonth: number
  totalPatients: number
  todayAppointments: TodayAppointment[]
  monthlyAppointments: { label: string; count: number }[]
}

const STATUS_LABELS: Record<string, string> = { SCHEDULED: 'Agendado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }
const STATUS_CLASS: Record<string, string> = { SCHEDULED: 'blue', COMPLETED: '', CANCELLED: 'neutral' }

@Component({
    selector: 'app-dashboard',
    imports: [CommonModule, RouterLink, KpiCardComponent, LineChartComponent, DonutChartComponent],
    template: `
    <div class="dashboard-page dashboard-home-page">
      <section class="dashboard-mobile-hero" aria-label="Resumo da clínica">
        <div>
          <span class="dashboard-mobile-eyebrow">Resumo de hoje</span>
          <h1>Olá, {{ greetingName }}!</h1>
          <p>{{ isDentist ? 'Veja seus atendimentos e pacientes.' : 'Veja como está a rotina da sua clínica.' }}</p>
        </div>
        <div class="dashboard-mobile-actions">
          @if (isAdmin) {
            <button type="button" (click)="privacy.toggle()" [attr.aria-label]="hideValues ? 'Mostrar valores' : 'Esconder valores'" [title]="hideValues ? 'Mostrar valores' : 'Esconder valores'">
              @if (hideValues) {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              } @else {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          }
          <button type="button" (click)="load()" [disabled]="loading" aria-label="Atualizar resumo" title="Atualizar resumo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </section>

      <div class="page-header">
        <div class="page-header-left">
          <h1>{{ isDentist ? 'Minha agenda' : 'Dashboard' }}</h1>
          <p>{{ isDentist ? 'Seus atendimentos e pacientes · ' + today : 'Visão geral da clínica · ' + today }}</p>
        </div>
        <div class="page-header-actions">
          @if (isAdmin) {
            <button class="btn btn-outline btn-sm" (click)="privacy.toggle()" [attr.aria-label]="hideValues ? 'Mostrar valores' : 'Esconder valores'" title="Esconder valores em dinheiro na tela">
              @if (hideValues) {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              } @else {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
              {{ hideValues ? 'Mostrar valores' : 'Esconder valores' }}
            </button>
          }
          <button class="btn btn-outline btn-sm" (click)="load()" [disabled]="loading">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Atualizar
          </button>
        </div>
      </div>

      @if (error) {
        <div class="card" style="background:var(--danger-bg);color:var(--danger-text);border-color:transparent;padding:14px 16px;">
          {{ error }}
        </div>
      }

      @if (isDentist) {
        @if (myMetrics) {
          <div class="grid cols-4 kpi-grid">
            <app-kpi-card *ngFor="let m of kpis" [metric]="m" (activated)="openMetric($event)"></app-kpi-card>
          </div>

          <ng-container [ngTemplateOutlet]="todayAgenda" [ngTemplateOutletContext]="{ $implicit: myMetrics.todayAppointments, showDentist: false }"></ng-container>

          @if (hasActivity) {
            <app-line-chart
              [points]="appointmentTrend"
              title="Meus atendimentos"
              subtitle="Últimos 6 meses"
            ></app-line-chart>
          }
        } @else if (loading) {
          <div class="grid cols-4 kpi-grid">
            <div class="card kpi-card skeleton" *ngFor="let i of [1,2,3,4]" style="height:88px;"></div>
          </div>
        }
      } @else {
        @if (metrics) {
          <div class="grid cols-4 kpi-grid">
            <app-kpi-card *ngFor="let m of kpis" [metric]="m" (activated)="openMetric($event)"></app-kpi-card>
          </div>

          <ng-container [ngTemplateOutlet]="todayAgenda" [ngTemplateOutletContext]="{ $implicit: metrics.todayAppointments, showDentist: true }"></ng-container>

          @if (hasActivity) {
            <div class="grid cols-2 dashboard-chart-grid">
              <app-line-chart
                [points]="patientTrend"
                title="Novos pacientes"
                subtitle="Últimos 6 meses"
              ></app-line-chart>
              @if (isAdmin && invoiceSlices.length) {
                <app-donut-chart
                  [slices]="invoiceSlices"
                  title="Cobranças"
                  subtitle="Situação atual"
                  valueSuffix=""
                ></app-donut-chart>
              } @else if (isAdmin) {
                <article class="card chart-card chart-card--empty">
                  <div class="chart-title-row">
                    <h2>Cobranças</h2>
                    <span class="muted">Situação atual</span>
                  </div>
                  <p class="muted" style="padding:24px 0;text-align:center;">Nenhuma cobrança registrada ainda.</p>
                </article>
              } @else if (operationalSlices.length) {
                <app-donut-chart
                  [slices]="operationalSlices"
                  title="Rotina da equipe"
                  subtitle="Pendências que pedem atenção"
                  valueSuffix=""
                ></app-donut-chart>
              } @else {
                <article class="card chart-card chart-card--empty">
                  <div class="chart-title-row">
                    <h2>Rotina da equipe</h2>
                    <span class="muted">Tudo organizado</span>
                  </div>
                  <p class="muted" style="padding:24px 0;text-align:center;">Nenhuma pendência operacional neste momento.</p>
                </article>
              }
            </div>
          } @else {
            <div class="card empty-state">
              <div class="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <h3>Sua clínica está pronta</h3>
              <p>Cadastre o primeiro paciente e agende a primeira consulta para começar a ver os números aqui.</p>
              <div class="empty-state-actions">
                <a routerLink="/app/patients" class="btn btn-primary btn-sm">Cadastrar paciente</a>
                <a routerLink="/app/appointments" class="btn btn-outline btn-sm">Ver agenda</a>
              </div>
            </div>
          }
        } @else if (loading) {
          <div class="grid cols-4 kpi-grid">
            <div class="card kpi-card skeleton" *ngFor="let i of [1,2,3,4]" style="height:88px;"></div>
          </div>
        }
      }
    </div>

    <!-- Agenda de hoje: sempre visível na home, mesmo sem atendimentos -->
    <ng-template #todayAgenda let-items let-showDentist="showDentist">
      <article class="card chart-card dashboard-today">
        <div class="chart-title-row">
          <h2>Agenda de hoje</h2>
          <a routerLink="/app/appointments" [queryParams]="{ view: 'list', range: 'today' }" class="dashboard-today-link">Ver todos <span aria-hidden="true">→</span></a>
        </div>
        @if (items.length) {
          <ul class="dashboard-upcoming-list">
            @for (u of items; track u.id) {
              <li>
                <div class="dashboard-upcoming-date">
                  <strong>{{ u.startTime | date:'HH:mm' }}</strong>
                  <span>{{ u.endTime | date:'HH:mm' }}</span>
                </div>
                <span class="dashboard-upcoming-name">{{ u.patientName }}</span>
                @if (showDentist) {
                  <span class="muted text-sm" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ u.dentistName || 'Sem dentista' }}</span>
                }
                <span class="status-chip" [class]="STATUS_CLASS[u.status]">{{ STATUS_LABELS[u.status] || u.status }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="muted" style="padding:24px 0;text-align:center;">Nenhuma consulta agendada para hoje.</p>
        }
      </article>
    </ng-template>
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  loading = false
  error = ''
  isDentist = false
  isAdmin = false
  hideValues = false
  greetingName = 'Dra.'

  metrics: DashboardMetrics | null = null
  myMetrics: MyMetrics | null = null
  kpis: KpiMetric[] = []
  patientTrend: ChartPoint[] = []
  appointmentTrend: ChartPoint[] = []
  invoiceSlices: DonutSlice[] = []
  operationalSlices: DonutSlice[] = []
  hasActivity = false

  readonly STATUS_LABELS = STATUS_LABELS
  readonly STATUS_CLASS = STATUS_CLASS

  private privacySub: Subscription | null = null

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    readonly privacy: PrivacyService,
    private readonly router: Router
  ) {
    this.isDentist = this.auth.isDentist()
    this.isAdmin = this.auth.isAdmin()
    const name = this.auth.getUser()?.name?.trim()
    this.greetingName = name ? name.split(/\s+/)[0] : (this.isDentist ? 'Dra.' : 'Administrador')
  }

  ngOnInit() {
    this.load()
    this.privacySub = this.privacy.hidden.subscribe(hidden => {
      this.hideValues = hidden
      if (this.metrics) this.buildViewModel(this.metrics)
    })
  }

  ngOnDestroy() {
    this.privacySub?.unsubscribe()
  }

  openMetric(metric: KpiMetric) {
    const appointmentFilters: Record<string, Record<string, string>> = {
      appointments: { view: 'list', range: 'today', status: 'SCHEDULED' },
      today: { view: 'list', range: 'today' },
      'next-seven-days': { view: 'list', range: 'next7', status: 'SCHEDULED' },
      confirmations: { view: 'list', confirmation: 'PENDING', status: 'SCHEDULED' },
      unassigned: { view: 'list', unassigned: '1', status: 'SCHEDULED' },
      week: { view: 'list', range: 'week' },
      completed: { view: 'list', range: 'month', status: 'COMPLETED' }
    }

    if (metric.id === 'patients') {
      void this.router.navigate(['/app/patients'])
      return
    }
    if (metric.id === 'revenue') {
      void this.router.navigate(['/app/finance'], { queryParams: { tab: 'overview', period: 'month' } })
      return
    }
    if (metric.id === 'pending') {
      void this.router.navigate(['/app/finance'], { queryParams: { tab: 'receivables', status: 'OPEN' } })
      return
    }
    const queryParams = appointmentFilters[metric.id]
    if (queryParams) void this.router.navigate(['/app/appointments'], { queryParams })
  }

  load() {
    this.loading = true
    this.error = ''
    const url = this.isDentist ? '/api/dashboard/my-metrics' : '/api/dashboard/metrics'
    this.http.get<DashboardMetrics | MyMetrics>(url).subscribe({
      next: metrics => {
        this.loading = false
        if (this.isDentist) {
          this.myMetrics = metrics as MyMetrics
          this.buildDentistViewModel(this.myMetrics)
        } else {
          this.metrics = metrics as DashboardMetrics
          this.buildViewModel(this.metrics)
        }
      },
      error: () => {
        this.loading = false
        this.error = 'Não foi possível carregar os números agora. Tente atualizar novamente.'
      }
    })
  }

  private buildViewModel(m: DashboardMetrics) {
    const revenueValue = this.hideValues
      ? 'R$ ••••••'
      : `R$ ${m.revenueThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

    this.kpis = this.isAdmin ? [
      { id: 'patients', title: 'Pacientes', value: String(m.patientCount), delta: `${m.newPatientsThisMonth} novos neste mês` },
      { id: 'appointments', title: 'Consultas hoje', value: String(m.appointmentsToday), delta: 'Agendadas para hoje' },
      { id: 'revenue', title: 'Faturamento do mês', value: revenueValue, delta: 'Cobranças pagas no mês' },
      { id: 'pending', title: 'Cobranças pendentes', value: String(m.invoicesStatus.pending + m.invoicesStatus.partial), delta: 'Aguardando pagamento' }
    ] : [
      { id: 'appointments', title: 'Consultas hoje', value: String(m.appointmentsToday), delta: 'Agendadas para hoje' },
      { id: 'next-seven-days', title: 'Próximos 7 dias', value: String(m.appointmentsNextSevenDays), delta: 'Consultas programadas' },
      { id: 'confirmations', title: 'Aguardando confirmação', value: String(m.pendingConfirmations), delta: 'Pacientes sem resposta' },
      { id: 'unassigned', title: 'Sem dentista', value: String(m.unassignedAppointments), delta: 'Agendamentos para organizar' }
    ]

    this.patientTrend = m.monthlyPatients.map(p => ({ label: p.label, value: p.count }))

    this.invoiceSlices = [
      { label: 'Pagas', value: m.invoicesStatus.paid, color: '#22c55e' },
      { label: 'Pendentes', value: m.invoicesStatus.pending, color: '#f59e0b' },
      { label: 'Parciais', value: m.invoicesStatus.partial, color: '#3b82f6' },
      { label: 'Canceladas', value: m.invoicesStatus.cancelled, color: '#ef4444' }
    ].filter(s => s.value > 0)

    this.operationalSlices = [
      { label: 'Aguardando confirmação', value: m.pendingConfirmations, color: '#f59e0b' },
      { label: 'Sem dentista', value: m.unassignedAppointments, color: '#ef4444' },
      { label: 'Concluídas no mês', value: m.completedThisMonth, color: '#22c55e' },
      { label: 'Novos pacientes', value: m.newPatientsThisMonth, color: '#3b82f6' }
    ].filter(s => s.value > 0)

    const totalInvoices = m.invoicesStatus.paid + m.invoicesStatus.pending + m.invoicesStatus.partial + m.invoicesStatus.cancelled
    const patientsInTrend = m.monthlyPatients.reduce((acc, p) => acc + p.count, 0)
    this.hasActivity = m.patientCount > 0 || m.appointmentsToday > 0 || (this.isAdmin && totalInvoices > 0) || patientsInTrend > 0
  }

  private buildDentistViewModel(m: MyMetrics) {
    this.kpis = [
      { id: 'today', title: 'Consultas hoje', value: String(m.appointmentsToday), delta: 'Agendadas para hoje' },
      { id: 'week', title: 'Esta semana', value: String(m.appointmentsThisWeek), delta: 'No total da semana' },
      { id: 'completed', title: 'Concluídas no mês', value: String(m.completedThisMonth), delta: 'Atendimentos finalizados' },
      { id: 'patients', title: 'Meus pacientes', value: String(m.totalPatients), delta: 'Pacientes atendidos' }
    ]
    this.appointmentTrend = m.monthlyAppointments.map(p => ({ label: p.label, value: p.count }))
    const trendTotal = m.monthlyAppointments.reduce((acc, p) => acc + p.count, 0)
    this.hasActivity = m.appointmentsToday > 0 || m.appointmentsThisWeek > 0 || m.totalPatients > 0 || trendTotal > 0
  }
}
