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
import { ToastService } from '../../services/toast.service'
import { ChartPoint, DonutSlice, KpiMetric } from '../../models/analytics.model'

type TodayAppointment = { id: string; patientName: string; dentistName?: string | null; startTime: string; endTime: string; status: string; confirmationStatus?: string | null }
type TimelinePhase = 'completed' | 'cancelled' | 'current' | 'overdue' | 'upcoming'
type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

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
    styleUrl: './dashboard.component.css',
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
          <div class="grid cols-4 kpi-grid dashboard-primary-kpis">
            <app-kpi-card *ngFor="let m of kpis" [metric]="m" [compact]="true" (activated)="openMetric($event)"></app-kpi-card>
          </div>

          <ng-container [ngTemplateOutlet]="todayAgenda" [ngTemplateOutletContext]="{ $implicit: myMetrics.todayAppointments, showDentist: false }"></ng-container>

          @if (hasActivity) {
            <app-line-chart
              [points]="appointmentTrend"
              title="Meus atendimentos"
              subtitle="Últimos 6 meses"
              [compact]="true"
            ></app-line-chart>
          }
        } @else if (loading) {
          <div class="grid cols-4 kpi-grid">
            <div class="card kpi-card skeleton" *ngFor="let i of [1,2,3,4]" style="height:88px;"></div>
          </div>
        }
      } @else {
        @if (metrics) {
          <div class="grid cols-4 kpi-grid dashboard-primary-kpis" [class.dashboard-primary-kpis--admin]="isAdmin">
            <app-kpi-card *ngFor="let m of kpis" [metric]="m" [compact]="true" (activated)="openMetric($event)"></app-kpi-card>
          </div>

          @if (isAdmin) {
            <section class="dashboard-section dashboard-command-section" aria-labelledby="dashboard-operation-title">
              <div class="dashboard-section-heading">
                <div>
                  <h2 id="dashboard-operation-title">Hoje, em foco</h2>
                  <p>Agenda do dia e pontos que precisam de atenção.</p>
                </div>
                <a routerLink="/app/appointments" class="dashboard-today-link">Abrir agenda <span aria-hidden="true">→</span></a>
              </div>
              <div class="dashboard-command-grid">
                <ng-container [ngTemplateOutlet]="todayAgenda" [ngTemplateOutletContext]="{ $implicit: metrics.todayAppointments, showDentist: true }"></ng-container>

                <article class="card dashboard-attention-card" aria-labelledby="dashboard-attention-title">
                  <div class="dashboard-attention-head">
                    <div><span>Central de atenção</span><h3 id="dashboard-attention-title">Pendências operacionais</h3></div>
                    <span class="dashboard-attention-count" [class.dashboard-attention-count--clear]="attentionCount === 0">{{ attentionCount || 'Tudo em dia' }}</span>
                  </div>
                  <div class="dashboard-attention-list">
                    <button type="button" (click)="openMetricById('confirmations')">
                      <span class="dashboard-attention-icon dashboard-attention-icon--warning" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.3 9.3 0 0 1-3.8-.9L3 21l1.8-5.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="M12 7.5V12l2.8 1.7"/></svg></span>
                      <span><strong>Aguardando confirmação</strong><small>Pacientes que ainda não responderam</small></span>
                      <b>{{ metrics.pendingConfirmations }}</b><i aria-hidden="true">→</i>
                    </button>
                    <button type="button" (click)="openMetricById('unassigned')">
                      <span class="dashboard-attention-icon dashboard-attention-icon--danger" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M18 8v4M18 16h.01"/></svg></span>
                      <span><strong>Sem dentista</strong><small>Consultas que precisam de responsável</small></span>
                      <b>{{ metrics.unassignedAppointments }}</b><i aria-hidden="true">→</i>
                    </button>
                    <button type="button" (click)="openMetricById('pending')">
                      <span class="dashboard-attention-icon dashboard-attention-icon--blue" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg></span>
                      <span><strong>Cobranças pendentes</strong><small>Pagamentos aguardando baixa</small></span>
                      <b>{{ metrics.invoicesStatus.pending + metrics.invoicesStatus.partial }}</b><i aria-hidden="true">→</i>
                    </button>
                  </div>
                  <div class="dashboard-attention-footer">
                    <div><span>Próximos 7 dias</span><strong>{{ metrics.appointmentsNextSevenDays }}</strong></div>
                    <div><span>Concluídas no mês</span><strong>{{ metrics.completedThisMonth }}</strong></div>
                  </div>
                </article>
              </div>
            </section>
          } @else {
            <ng-container [ngTemplateOutlet]="todayAgenda" [ngTemplateOutletContext]="{ $implicit: metrics.todayAppointments, showDentist: true }"></ng-container>
          }

          @if (hasActivity) {
            <section class="dashboard-section" aria-labelledby="dashboard-analysis-title">
              <div class="dashboard-section-heading">
                <div>
                  <h2 id="dashboard-analysis-title">Análises da clínica</h2>
                  <p>Crescimento, rotina operacional e situação das cobranças.</p>
                </div>
              </div>
              @if (isAdmin) {
                <div class="dashboard-admin-analysis-grid dashboard-chart-grid">
                  <app-line-chart
                    [points]="patientTrend"
                    title="Evolução de pacientes"
                    subtitle="Novos cadastros · últimos 6 meses"
                    [compact]="true"
                  ></app-line-chart>

                  <article class="card dashboard-month-card">
                    <div class="dashboard-month-head">
                      <div><span>Resumo mensal</span><h3>Desempenho da clínica</h3></div>
                      <a routerLink="/app/finance">Ver financeiro <span aria-hidden="true">→</span></a>
                    </div>
                    <div class="dashboard-month-stats">
                      <div><span>Novos pacientes</span><strong>{{ metrics.newPatientsThisMonth }}</strong><small>neste mês</small></div>
                      <div><span>Consultas concluídas</span><strong>{{ metrics.completedThisMonth }}</strong><small>neste mês</small></div>
                    </div>
                    <div class="dashboard-finance-summary">
                      <div class="dashboard-finance-title"><span>Situação das cobranças</span><strong>{{ invoiceTotal }} registros</strong></div>
                      @if (invoiceSlices.length) {
                        <div class="dashboard-finance-bar" aria-label="Distribuição das cobranças">
                          @for (slice of invoiceSlices; track slice.label) {
                            <span [style.width.%]="invoicePercentage(slice.value)" [style.background]="slice.color" [title]="slice.label + ': ' + slice.value"></span>
                          }
                        </div>
                        <div class="dashboard-finance-legend">
                          @for (slice of invoiceSlices; track slice.label) {
                            <div><i [style.background]="slice.color"></i><span>{{ slice.label }}</span><strong>{{ slice.value }}</strong></div>
                          }
                        </div>
                      } @else {
                        <p>Nenhuma cobrança registrada ainda.</p>
                      }
                    </div>
                  </article>
                </div>
              } @else {
                <div class="dashboard-analytics-grid dashboard-chart-grid">
                  <app-line-chart [points]="patientTrend" title="Novos pacientes" subtitle="Últimos 6 meses" [compact]="true"></app-line-chart>
                  @if (operationalSlices.length) {
                    <app-donut-chart [slices]="operationalSlices" title="Rotina da equipe" subtitle="Indicadores operacionais" valueSuffix="" [compact]="true"></app-donut-chart>
                  } @else {
                    <article class="card chart-card chart-card--empty chart-card--compact">
                      <div class="chart-title-row"><h2>Rotina da equipe</h2><span class="muted">Tudo organizado</span></div>
                      <p class="muted dashboard-chart-empty">Nenhuma pendência operacional neste momento.</p>
                    </article>
                  }
                </div>
              }
            </section>
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
        <div class="chart-title-row dashboard-timeline-head">
          <div>
            <h2>Agenda de hoje</h2>
            <p><span aria-hidden="true"></span>Agora, {{ currentTime | date:'HH:mm' }} · {{ timelineSummary(items) }}</p>
          </div>
          <div class="dashboard-timeline-head-actions">
            <span>Altere pelo status</span>
            <a routerLink="/app/appointments" [queryParams]="{ view: 'list', range: 'today' }" class="dashboard-today-link">Ver todos <span aria-hidden="true">→</span></a>
          </div>
        </div>
        @if (items.length) {
          @let timeline = timelineWindow(items);
          <div class="dashboard-timeline-window">
            @if (timeline.before) {
              <div class="dashboard-timeline-overflow">{{ timeline.before }} {{ timeline.before === 1 ? 'horário anterior' : 'horários anteriores' }}</div>
            }
            <ol class="dashboard-timeline-list">
              @for (u of timeline.items; track u.id) {
                <li [class]="'dashboard-timeline-item is-' + appointmentPhase(u)" [attr.aria-current]="appointmentPhase(u) === 'current' ? 'time' : null">
                  <span class="dashboard-timeline-rail" aria-hidden="true"><i></i></span>
                  <time>
                    <strong>{{ u.startTime | date:'HH:mm' }}</strong>
                    <span>até {{ u.endTime | date:'HH:mm' }}</span>
                  </time>
                  <div class="dashboard-timeline-copy">
                    <strong>{{ u.patientName }}</strong>
                    @if (showDentist) {
                      <span>{{ u.dentistName || 'Sem dentista definido' }}</span>
                    } @else {
                      <span>Consulta odontológica</span>
                    }
                  </div>
                  <div class="dashboard-timeline-status" [class.is-updating]="updatingAppointmentId === u.id">
                    <label class="dashboard-status-control">
                      <span class="sr-only">Alterar status da consulta de {{ u.patientName }}</span>
                      <select [value]="u.status" [disabled]="updatingAppointmentId === u.id" (change)="updateAppointmentStatus(u, $event)" [attr.aria-label]="'Alterar status da consulta de ' + u.patientName">
                        <option value="SCHEDULED">Agendada</option>
                        <option value="COMPLETED">Concluída</option>
                        <option value="CANCELLED">Cancelada</option>
                      </select>
                      @if (updatingAppointmentId === u.id) {
                        <i class="dashboard-status-spinner" aria-hidden="true"></i>
                      } @else {
                        <i class="dashboard-status-chevron" aria-hidden="true">⌄</i>
                      }
                    </label>
                    <span>{{ appointmentPhaseLabel(u) }} · {{ appointmentStatusDetail(u) }}</span>
                  </div>
                </li>
              }
            </ol>
            @if (timeline.after) {
              <div class="dashboard-timeline-overflow is-after">Mais {{ timeline.after }} {{ timeline.after === 1 ? 'horário depois' : 'horários depois' }}</div>
            }
          </div>
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
  operationalKpis: KpiMetric[] = []
  patientTrend: ChartPoint[] = []
  appointmentTrend: ChartPoint[] = []
  invoiceSlices: DonutSlice[] = []
  operationalSlices: DonutSlice[] = []
  invoiceTotal = 0
  attentionCount = 0
  hasActivity = false
  currentTime = new Date()
  updatingAppointmentId: string | null = null

  readonly STATUS_LABELS = STATUS_LABELS
  readonly STATUS_CLASS = STATUS_CLASS

  private privacySub: Subscription | null = null
  private clockTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    readonly privacy: PrivacyService,
    private readonly router: Router,
    private readonly toast: ToastService
  ) {
    this.isDentist = this.auth.isDentist()
    this.isAdmin = this.auth.isAdmin()
    const name = this.auth.getUser()?.name?.trim()
    this.greetingName = name ? name.split(/\s+/)[0] : (this.isDentist ? 'Dra.' : 'Administrador')
  }

  ngOnInit() {
    this.load()
    this.clockTimer = setInterval(() => { this.currentTime = new Date() }, 30_000)
    this.privacySub = this.privacy.hidden.subscribe(hidden => {
      this.hideValues = hidden
      if (this.metrics) this.buildViewModel(this.metrics)
    })
  }

  ngOnDestroy() {
    this.privacySub?.unsubscribe()
    if (this.clockTimer) clearInterval(this.clockTimer)
  }

  timelineWindow(items: TodayAppointment[]) {
    const sorted = [...items].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    const limit = 5
    if (sorted.length <= limit) return { items: sorted, before: 0, after: 0 }

    const now = this.currentTime.getTime()
    let focus = sorted.findIndex(item => this.appointmentPhase(item) === 'current')
    if (focus < 0) focus = sorted.findIndex(item => item.status !== 'CANCELLED' && new Date(item.startTime).getTime() >= now)
    if (focus < 0) focus = sorted.length - 1

    const start = Math.max(0, Math.min(focus - 2, sorted.length - limit))
    return { items: sorted.slice(start, start + limit), before: start, after: sorted.length - start - limit }
  }

  appointmentPhase(item: TodayAppointment): TimelinePhase {
    if (item.status === 'COMPLETED') return 'completed'
    if (item.status === 'CANCELLED') return 'cancelled'
    const now = this.currentTime.getTime()
    const start = new Date(item.startTime).getTime()
    const end = new Date(item.endTime).getTime()
    if (now >= start && now < end) return 'current'
    return now >= end ? 'overdue' : 'upcoming'
  }

  appointmentPhaseLabel(item: TodayAppointment) {
    const labels: Record<TimelinePhase, string> = {
      completed: 'Concluída',
      cancelled: 'Cancelada',
      current: 'Em atendimento',
      overdue: 'Horário passou',
      upcoming: 'Próxima'
    }
    return labels[this.appointmentPhase(item)]
  }

  appointmentStatusDetail(item: TodayAppointment) {
    const phase = this.appointmentPhase(item)
    if (phase === 'completed') return 'Atendimento finalizado'
    if (phase === 'cancelled') return 'Não haverá atendimento'
    if (phase === 'overdue') return 'Ainda consta como agendada'
    if (item.confirmationStatus === 'CONFIRMED') return 'Presença confirmada'
    if (item.confirmationStatus === 'DECLINED') return 'Paciente não poderá comparecer'
    return 'Aguardando confirmação'
  }

  timelineSummary(items: TodayAppointment[]) {
    const current = items.filter(item => this.appointmentPhase(item) === 'current').length
    if (current) return `${current} em atendimento agora`
    const overdue = items.filter(item => this.appointmentPhase(item) === 'overdue').length
    if (overdue) return `${overdue} ${overdue === 1 ? 'horário precisa' : 'horários precisam'} de atualização`
    const upcoming = items.filter(item => this.appointmentPhase(item) === 'upcoming').length
    if (upcoming) return `${upcoming} ${upcoming === 1 ? 'consulta restante' : 'consultas restantes'}`
    return 'agenda do dia finalizada'
  }

  updateAppointmentStatus(item: TodayAppointment, event: Event) {
    const select = event.target as HTMLSelectElement
    const nextStatus = select.value as AppointmentStatus
    const previousStatus = item.status
    if (nextStatus === previousStatus || this.updatingAppointmentId) return

    this.updatingAppointmentId = item.id
    this.http.put<TodayAppointment>(`/api/appointments/${item.id}`, { status: nextStatus }).subscribe({
      next: () => {
        item.status = nextStatus
        this.updatingAppointmentId = null
        const label = STATUS_LABELS[nextStatus] || nextStatus
        this.toast.success('Status atualizado', `${item.patientName}: ${label.toLowerCase()}.`)
        this.load()
      },
      error: error => {
        select.value = previousStatus
        this.updatingAppointmentId = null
        this.toast.error('Não foi possível atualizar o status', error.error?.message || 'Tente novamente em instantes.')
      }
    })
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
      void this.router.navigate([this.isDentist ? '/app/records' : '/app/patients'])
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

  openMetricById(id: string) {
    const metric = [...this.kpis, ...this.operationalKpis].find(item => item.id === id)
    if (metric) this.openMetric(metric)
  }

  invoicePercentage(value: number) {
    return this.invoiceTotal ? (value / this.invoiceTotal) * 100 : 0
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

    this.operationalKpis = this.isAdmin ? [
      { id: 'next-seven-days', title: 'Próximos 7 dias', value: String(m.appointmentsNextSevenDays), delta: 'Consultas programadas' },
      { id: 'confirmations', title: 'Aguardando confirmação', value: String(m.pendingConfirmations), delta: 'Pacientes sem resposta' },
      { id: 'unassigned', title: 'Sem dentista', value: String(m.unassignedAppointments), delta: 'Agendamentos para organizar' },
      { id: 'completed', title: 'Concluídas no mês', value: String(m.completedThisMonth), delta: 'Atendimentos finalizados' }
    ] : []

    this.patientTrend = m.monthlyPatients.map(p => ({ label: p.label, value: p.count }))

    this.invoiceSlices = [
      { label: 'Pagas', value: m.invoicesStatus.paid, color: '#22c55e' },
      { label: 'Pendentes', value: m.invoicesStatus.pending, color: '#f59e0b' },
      { label: 'Parciais', value: m.invoicesStatus.partial, color: '#3b82f6' },
      { label: 'Canceladas', value: m.invoicesStatus.cancelled, color: '#ef4444' }
    ].filter(s => s.value > 0)
    this.invoiceTotal = m.invoicesStatus.paid + m.invoicesStatus.pending + m.invoicesStatus.partial + m.invoicesStatus.cancelled
    this.attentionCount = m.pendingConfirmations + m.unassignedAppointments + m.invoicesStatus.pending + m.invoicesStatus.partial

    this.operationalSlices = [
      { label: 'Aguardando confirmação', value: m.pendingConfirmations, color: '#f59e0b' },
      { label: 'Sem dentista', value: m.unassignedAppointments, color: '#ef4444' },
      { label: 'Concluídas no mês', value: m.completedThisMonth, color: '#22c55e' },
      { label: 'Novos pacientes', value: m.newPatientsThisMonth, color: '#3b82f6' }
    ].filter(s => s.value > 0)

    const totalInvoices = this.invoiceTotal
    const patientsInTrend = m.monthlyPatients.reduce((acc, p) => acc + p.count, 0)
    this.hasActivity = m.patientCount > 0 || m.appointmentsToday > 0 || (this.isAdmin && totalInvoices > 0) || patientsInTrend > 0
  }

  private buildDentistViewModel(m: MyMetrics) {
    this.kpis = [
      { id: 'today', title: 'Consultas hoje', value: String(m.appointmentsToday), delta: 'Agendadas para hoje' },
      { id: 'week', title: 'Esta semana', value: String(m.appointmentsThisWeek), delta: 'No total da semana' },
      { id: 'completed', title: 'Concluídas no mês', value: String(m.completedThisMonth), delta: 'Atendimentos finalizados' },
      { id: 'patients', title: 'Meus pacientes', value: String(m.totalPatients), delta: 'Vinculados à minha agenda' }
    ]
    this.appointmentTrend = m.monthlyAppointments.map(p => ({ label: p.label, value: p.count }))
    const trendTotal = m.monthlyAppointments.reduce((acc, p) => acc + p.count, 0)
    this.hasActivity = m.appointmentsToday > 0 || m.appointmentsThisWeek > 0 || m.totalPatients > 0 || trendTotal > 0
  }
}
