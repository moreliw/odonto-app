import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { Subscription } from 'rxjs'
import { LineChartComponent } from '../../components/analytics/line-chart.component'
import { ChartPoint, DonutSlice, KpiMetric } from '../../models/analytics.model'
import { AuthService } from '../../services/auth.service'
import { PrivacyService } from '../../services/privacy.service'
import { ToastService } from '../../services/toast.service'

type TodayAppointment = {
  id: string
  patientName: string
  dentistId?: string | null
  dentistName?: string | null
  startTime: string
  endTime: string
  status: string
  confirmationStatus?: string | null
}

type TimelinePhase = 'completed' | 'cancelled' | 'current' | 'overdue' | 'upcoming'
type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
type DashboardTone = 'blue' | 'green' | 'orange' | 'purple' | 'red'
type DashboardKpi = KpiMetric & { tone: DashboardTone; note: string }

type DashboardMetrics = {
  patientCount: number
  appointmentsToday: number
  appointmentsNextSevenDays: number
  pendingConfirmations: number
  unassignedAppointments: number
  completedThisMonth: number
  newPatientsThisMonth: number
  canViewFinancial: boolean
  billedThisMonth: number
  revenueThisMonth: number
  expensesThisMonth: number
  netThisMonth: number
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

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada'
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterLink, LineChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  loading = false
  error = ''
  isDentist = false
  isAdmin = false
  canManageAppointments = false
  canManageFinance = false
  canAccessPatients = false
  canAccessRecords = false
  canManagePatients = false
  canAccessTeam = false
  hideValues = false
  greetingName = 'Administrador'
  globalSearch = ''

  metrics: DashboardMetrics | null = null
  myMetrics: MyMetrics | null = null
  kpis: DashboardKpi[] = []
  patientTrend: ChartPoint[] = []
  appointmentTrend: ChartPoint[] = []
  agendaSlices: DonutSlice[] = []
  currentTime = new Date()
  updatingAppointmentId: string | null = null
  selectedDentist = 'ALL'
  openStatusMenuId: string | null = null
  pendingStatusChange: { item: TodayAppointment; nextStatus: AppointmentStatus } | null = null

  readonly STATUS_LABELS = STATUS_LABELS
  readonly statusOptions: { value: AppointmentStatus; label: string }[] = [
    { value: 'SCHEDULED', label: 'Agendada' },
    { value: 'COMPLETED', label: 'Concluída' },
    { value: 'CANCELLED', label: 'Cancelada' }
  ]

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
    this.isAdmin = this.auth.hasPermission('FINANCE_VIEW')
    this.canManageAppointments = this.auth.hasPermission('APPOINTMENTS_MANAGE')
    this.canManageFinance = this.auth.hasPermission('FINANCE_MANAGE')
    this.canAccessPatients = this.auth.hasPermission('PATIENTS_VIEW')
    this.canAccessRecords = this.auth.hasPermission('RECORDS_VIEW')
    this.canManagePatients = this.auth.hasPermission('PATIENTS_MANAGE')
    this.canAccessTeam = this.auth.hasPermission('TEAM_VIEW')
    const name = this.auth.getUser()?.name?.trim()
    this.greetingName = name ? name.split(/\s+/)[0] : (this.isDentist ? 'Doutor(a)' : 'Administrador')
  }

  ngOnInit() {
    this.load()
    this.clockTimer = setInterval(() => { this.currentTime = new Date() }, 30_000)
    this.privacySub = this.privacy.hidden.subscribe(hidden => {
      this.hideValues = hidden
      this.rebuildViewModel()
    })
  }

  ngOnDestroy() {
    this.privacySub?.unsubscribe()
    if (this.clockTimer) clearInterval(this.clockTimer)
  }

  get agendaItems() {
    const items = this.isDentist ? this.myMetrics?.todayAppointments : this.metrics?.todayAppointments
    return this.filteredTodayAppointments(this.todayAppointments(items || []), !this.isDentist)
  }

  get highlightedId() {
    return this.highlightedAppointmentId(this.agendaItems)
  }

  get agendaTotal() {
    return this.agendaSlices.reduce((total, slice) => total + slice.value, 0)
  }

  get agendaDistributionGradient() {
    if (!this.agendaTotal) return 'conic-gradient(#e7edf7 0 100%)'
    let cursor = 0
    const stops = this.agendaSlices.map(slice => {
      const start = cursor
      cursor += (slice.value / this.agendaTotal) * 100
      return `${slice.color} ${start}% ${cursor}%`
    })
    return `conic-gradient(${stops.join(', ')})`
  }

  get analysisTitle() {
    return this.isDentist ? 'Meus atendimentos' : 'Novos pacientes'
  }

  get analysisSubtitle() {
    return 'Crescimento dos últimos 6 meses'
  }

  get analysisPoints() {
    return this.isDentist ? this.appointmentTrend : this.patientTrend
  }

  get billedValue() {
    return this.money(this.metrics?.billedThisMonth || 0)
  }

  get receivedValue() {
    return this.money(this.metrics?.revenueThisMonth || 0)
  }

  get expensesValue() {
    return this.money(this.metrics?.expensesThisMonth || 0)
  }

  get netValue() {
    return this.money(this.metrics?.netThisMonth || 0)
  }

  todayAppointments(items: TodayAppointment[]) {
    return [...items].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }

  filteredTodayAppointments(items: TodayAppointment[], showDentist: boolean) {
    if (!showDentist || this.selectedDentist === 'ALL') return items
    return items.filter(item => this.dentistFilterValue(item) === this.selectedDentist)
  }

  dentistOptions(items: TodayAppointment[]) {
    const options = new Map<string, string>()
    for (const item of items) {
      const value = this.dentistFilterValue(item)
      options.set(value, item.dentistName?.trim() || 'Sem dentista')
    }
    return [...options.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }

  changeDentistFilter(event: Event) {
    this.selectedDentist = (event.target as HTMLSelectElement).value
    this.openStatusMenuId = null
  }

  toggleStatusMenu(item: TodayAppointment) {
    if (this.updatingAppointmentId) return
    this.openStatusMenuId = this.openStatusMenuId === item.id ? null : item.id
  }

  closeStatusMenu() {
    this.openStatusMenuId = null
  }

  private dentistFilterValue(item: TodayAppointment) {
    if (item.dentistId) return `id:${item.dentistId}`
    if (item.dentistName?.trim()) return `name:${item.dentistName.trim().toLocaleLowerCase('pt-BR')}`
    return '__UNASSIGNED__'
  }

  highlightedAppointmentId(items: TodayAppointment[]) {
    if (!items.length) return null
    const actionable = items.filter(item => item.status === 'SCHEDULED')
    const source = actionable.length ? actionable : items
    const now = this.currentTime.getTime()
    const inProgress = source.find(item => now >= new Date(item.startTime).getTime() && now < new Date(item.endTime).getTime())
    if (inProgress) return inProgress.id
    return source.reduce((closest, item) => {
      const distance = this.appointmentDistanceFromNow(item, now)
      const closestDistance = this.appointmentDistanceFromNow(closest, now)
      return distance < closestDistance ? item : closest
    }).id
  }

  private appointmentDistanceFromNow(item: TodayAppointment, now: number) {
    const start = new Date(item.startTime).getTime()
    const end = new Date(item.endTime).getTime()
    if (now < start) return start - now
    if (now >= end) return now - end
    return 0
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

  requestAppointmentStatusChange(item: TodayAppointment, nextStatus: AppointmentStatus) {
    if (nextStatus === item.status || this.updatingAppointmentId) return
    this.pendingStatusChange = { item, nextStatus }
    this.openStatusMenuId = null
  }

  cancelAppointmentStatusChange() {
    this.pendingStatusChange = null
  }

  closeConfirmOnBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) this.cancelAppointmentStatusChange()
  }

  confirmAppointmentStatusChange() {
    if (!this.pendingStatusChange) return
    const { item, nextStatus } = this.pendingStatusChange
    this.pendingStatusChange = null
    this.updateAppointmentStatus(item, nextStatus)
  }

  private updateAppointmentStatus(item: TodayAppointment, nextStatus: AppointmentStatus) {
    const previousStatus = item.status
    if (nextStatus === previousStatus || this.updatingAppointmentId) return
    this.updatingAppointmentId = item.id
    this.http.put<TodayAppointment>(`/api/appointments/${item.id}`, { status: nextStatus }).subscribe({
      next: () => {
        item.status = nextStatus
        this.updatingAppointmentId = null
        this.toast.success('Status atualizado', `${item.patientName}: ${STATUS_LABELS[nextStatus].toLowerCase()}.`)
        this.load()
      },
      error: error => {
        this.updatingAppointmentId = null
        this.toast.error('Não foi possível atualizar o status', error.error?.message || 'Tente novamente em instantes.')
      }
    })
  }

  openMetric(metric: KpiMetric) {
    const appointmentFilters: Record<string, Record<string, string>> = {
      appointments: { view: 'list', range: 'today' },
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
    const queryParams = appointmentFilters[metric.id]
    if (queryParams) void this.router.navigate(['/app/appointments'], { queryParams })
  }

  submitGlobalSearch() {
    const search = this.globalSearch.trim()
    if (!search) return
    void this.router.navigate([this.isDentist ? '/app/records' : '/app/patients'], { queryParams: { search } })
  }

  load() {
    this.loading = true
    this.error = ''
    const url = this.isDentist ? '/api/dashboard/my-metrics' : '/api/dashboard/metrics'
    this.http.get<DashboardMetrics | MyMetrics>(url).subscribe({
      next: result => {
        this.loading = false
        if (this.isDentist) {
          this.myMetrics = result as MyMetrics
          this.buildDentistViewModel(this.myMetrics)
        } else {
          this.metrics = result as DashboardMetrics
          this.buildViewModel(this.metrics)
        }
      },
      error: () => {
        this.loading = false
        this.error = 'Não foi possível carregar os números agora. Tente atualizar novamente.'
      }
    })
  }

  private rebuildViewModel() {
    if (this.metrics) this.buildViewModel(this.metrics)
    if (this.myMetrics) this.buildDentistViewModel(this.myMetrics)
  }

  private buildViewModel(m: DashboardMetrics) {
    const billed = this.money(m.billedThisMonth)
    this.kpis = [
      { id: 'appointments', tone: 'blue', title: 'Consultas hoje', value: String(m.appointmentsToday), delta: 'Registradas no dia', note: 'Agenda completa de hoje' },
      { id: 'next-seven-days', tone: 'blue', title: 'Próximos 7 dias', value: String(m.appointmentsNextSevenDays), delta: 'Consultas programadas', note: 'Planejamento da semana' },
      { id: 'confirmations', tone: 'orange', title: 'Aguardando confirmação', value: String(m.pendingConfirmations), delta: 'Pacientes sem resposta', note: m.pendingConfirmations ? 'Atenção necessária' : 'Tudo confirmado' },
      { id: 'patients', tone: 'purple', title: 'Novos pacientes (mês)', value: String(m.newPatientsThisMonth), delta: 'Cadastros no período', note: `${m.patientCount} pacientes na base` },
      this.isAdmin
        ? { id: 'revenue', tone: 'green', title: 'Faturamento (mês)', value: billed, delta: 'Produção no período', note: 'Visão financeira mensal' }
        : { id: 'unassigned', tone: 'red', title: 'Sem dentista', value: String(m.unassignedAppointments), delta: 'Agendas para organizar', note: m.unassignedAppointments ? 'Ação recomendada' : 'Tudo organizado' }
    ]
    this.patientTrend = m.monthlyPatients.map(point => ({ label: point.label, value: point.count }))
    this.buildAgendaSlices(m.todayAppointments)
  }

  private buildDentistViewModel(m: MyMetrics) {
    this.kpis = [
      { id: 'today', tone: 'blue', title: 'Consultas hoje', value: String(m.appointmentsToday), delta: 'Registradas no dia', note: 'Sua agenda de hoje' },
      { id: 'week', tone: 'blue', title: 'Esta semana', value: String(m.appointmentsThisWeek), delta: 'Consultas programadas', note: 'Visão semanal' },
      { id: 'completed', tone: 'green', title: 'Concluídas no mês', value: String(m.completedThisMonth), delta: 'Atendimentos finalizados', note: 'Produção mensal' },
      { id: 'patients', tone: 'purple', title: 'Meus pacientes', value: String(m.totalPatients), delta: 'Vinculados à sua agenda', note: 'Base acompanhada' }
    ]
    this.appointmentTrend = m.monthlyAppointments.map(point => ({ label: point.label, value: point.count }))
    this.buildAgendaSlices(m.todayAppointments)
  }

  private buildAgendaSlices(items: TodayAppointment[]) {
    const pending = items.filter(item => item.status === 'SCHEDULED' && (item.confirmationStatus || 'PENDING') === 'PENDING').length
    const scheduled = items.filter(item => item.status === 'SCHEDULED').length - pending
    const completed = items.filter(item => item.status === 'COMPLETED').length
    const cancelled = items.filter(item => item.status === 'CANCELLED').length
    this.agendaSlices = [
      { label: 'Agendadas', value: scheduled, color: '#3478f6' },
      { label: 'Concluídas', value: completed, color: '#28b768' },
      { label: 'Canceladas', value: cancelled, color: '#ef7f79' },
      { label: 'Aguardando', value: pending, color: '#f3a23a' }
    ].filter(slice => slice.value > 0)
  }

  private money(value: number) {
    if (this.hideValues) return 'R$ ••••••'
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
}
