import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'
import { AuthService } from '../../services/auth.service'

type Patient = { id: string; name: string }
type Dentist = { id: string; name: string }
type Appointment = {
  id: string
  patientId: string
  patient?: Patient
  dentistId?: string | null
  dentist?: Dentist | null
  startTime: string
  endTime: string
  status: string
  notes?: string
}
type CalendarBlock = Appointment & { top: number; height: number; left: number; width: number; colorIdx: number }

const STATUS_LABELS: Record<string, string> = { SCHEDULED: 'Agendado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }
const STATUS_CLASS: Record<string, string> = { SCHEDULED: 'blue', COMPLETED: '', CANCELLED: 'neutral' }
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const GRID_START_HOUR = 7
const GRID_END_HOUR = 20
const PX_PER_HOUR = 56
const DENTIST_PALETTE = ['#2563eb', '#14b8a6', '#a855f7', '#f59e0b', '#ec4899', '#22c55e']

function startOfWeek(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() - r.getDay())
  return r
}
function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** Hash simples e estável do id para escolher uma cor consistente por dentista. */
function colorIndexFor(id: string | null | undefined) {
  if (!id) return 0
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % DENTIST_PALETTE.length
  return h
}

@Component({
    selector: 'app-appointments',
    imports: [CommonModule, FormsModule],
    template: `
    <div class="agenda-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Agenda</h1>
          <p>{{ isDentist ? 'Seus atendimentos agendados' : 'Consultas e procedimentos agendados' }}</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" (click)="openCreate()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova consulta
          </button>
        </div>
      </div>

      <div class="agenda-toolbar">
        <div class="agenda-view-toggle">
          <button class="agenda-view-btn" [class.active]="view === 'week'" (click)="setView('week')">Semana</button>
          <button class="agenda-view-btn" [class.active]="view === 'list'" (click)="setView('list')">Lista</button>
        </div>

        @if (view === 'week') {
          <div class="agenda-nav">
            <button class="btn btn-icon btn-sm" (click)="shiftWeek(-1)" aria-label="Semana anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button class="btn btn-outline btn-sm" (click)="goToday()">Hoje</button>
            <button class="btn btn-icon btn-sm" (click)="shiftWeek(1)" aria-label="Próxima semana">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <strong class="agenda-range-label">{{ rangeLabel }}</strong>
          </div>
        }

        @if (!isDentist && dentists.length > 0) {
          <select class="select agenda-dentist-filter" [(ngModel)]="dentistFilter" (ngModelChange)="load()">
            <option value="">Todos os dentistas</option>
            @for (d of dentists; track d.id) {
              <option [value]="d.id">{{ d.name }}</option>
            }
          </select>
        }

        <span class="spacer flex flex-1"></span>
        <span class="text-sm muted">{{ filtered.length }} consulta{{ filtered.length !== 1 ? 's' : '' }}</span>
      </div>

      @if (view === 'week') {
        <div class="card agenda-calendar">
          @if (loading) {
            <div class="table-empty"><span class="spinner spinner-dark"></span></div>
          } @else {
            <div class="agenda-week-head">
              <div class="agenda-hour-gutter"></div>
              @for (day of weekDays; track day.getTime()) {
                <div class="agenda-day-head" [class.is-today]="isToday(day)">
                  <span class="agenda-day-name">{{ DAY_LABELS[day.getDay()] }}</span>
                  <span class="agenda-day-num">{{ day.getDate() }}</span>
                </div>
              }
            </div>
            <div class="agenda-week-scroll">
              <div class="agenda-week-grid" [style.height.px]="gridHeight">
                <div class="agenda-hour-gutter">
                  @for (h of hours; track h) {
                    <div class="agenda-hour-label" [style.height.px]="pxPerHour">{{ h }}:00</div>
                  }
                </div>
                @for (day of weekDays; track day.getTime()) {
                  <div class="agenda-day-col" [class.is-today]="isToday(day)" (click)="onSlotClick($event, day)">
                    @for (h of hours; track h) {
                      <div class="agenda-hour-row" [style.height.px]="pxPerHour"></div>
                    }
                    @for (block of blocksByDay(day); track block.id) {
                      <button
                        type="button"
                        class="agenda-block"
                        [class]="'status-' + block.status.toLowerCase()"
                        [style.top.px]="block.top"
                        [style.height.px]="block.height"
                        [style.left.%]="block.left"
                        [style.width.%]="block.width"
                        [style.border-left-color]="!isDentist && block.dentist ? dentistColor(block.colorIdx) : null"
                        (click)="onBlockClick($event, block)"
                        [title]="(block.patient?.name || 'Paciente') + ' · ' + (block.startTime | date:'HH:mm') + '–' + (block.endTime | date:'HH:mm') + (block.dentist ? ' · ' + block.dentist.name : '')"
                      >
                        <strong>{{ block.patient?.name || 'Paciente' }}</strong>
                        <span>{{ block.startTime | date:'HH:mm' }}–{{ block.endTime | date:'HH:mm' }}</span>
                        @if (!isDentist && block.dentist) { <em>{{ block.dentist.name }}</em> }
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="card" style="padding:14px 20px;margin-bottom:16px;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            @for (opt of statusOpts; track opt.value) {
              <button
                class="btn btn-sm"
                [class.btn-primary]="filterStatus === opt.value"
                [class.btn-ghost]="filterStatus !== opt.value"
                (click)="filterStatus = opt.value"
              >{{ opt.label }}</button>
            }
          </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  @if (!isDentist) { <th>Dentista</th> }
                  <th>Data e hora</th>
                  <th>Duração</th>
                  <th>Status</th>
                  <th>Obs.</th>
                  <th style="width:80px;"></th>
                </tr>
              </thead>
              <tbody>
                @if (loading) {
                  <tr><td [attr.colspan]="isDentist ? 6 : 7" class="table-empty"><span class="spinner spinner-dark"></span></td></tr>
                } @else if (statusFiltered.length === 0) {
                  <tr><td [attr.colspan]="isDentist ? 6 : 7">
                    <div class="empty-state">
                      <div class="empty-state-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <h3>Nenhuma consulta encontrada</h3>
                      <p>{{ filterStatus !== 'ALL' ? 'Tente outro filtro de status' : 'Clique em "Nova consulta" para agendar' }}</p>
                    </div>
                  </td></tr>
                } @else {
                  @for (a of statusFiltered; track a.id) {
                    <tr>
                      <td>
                        <div style="display:flex;align-items:center;gap:10px;">
                          <div class="patient-avatar" style="flex-shrink:0;">{{ (a.patient?.name || '?')[0].toUpperCase() }}</div>
                          <span style="font-weight:500;">{{ a.patient?.name || a.patientId }}</span>
                        </div>
                      </td>
                      @if (!isDentist) { <td class="muted text-sm">{{ a.dentist?.name || '—' }}</td> }
                      <td>
                        <div style="font-weight:500;">{{ a.startTime | date:'dd/MM/yyyy' }}</div>
                        <div class="text-xs muted">{{ a.startTime | date:'HH:mm' }}</div>
                      </td>
                      <td class="muted text-sm">{{ duration(a.startTime, a.endTime) }}</td>
                      <td><span class="status-chip" [class]="STATUS_CLASS[a.status]">{{ STATUS_LABELS[a.status] || a.status }}</span></td>
                      <td class="muted text-sm" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ a.notes || '—' }}</td>
                      <td>
                        <div class="table-actions">
                          <button class="btn btn-sm btn-ghost" (click)="openEdit(a)" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button class="btn btn-sm btn-ghost" style="color:var(--danger);" (click)="confirmDelete(a)" title="Cancelar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <!-- Create / Edit Modal -->
    @if (showModal) {
      <div class="modal-backdrop" (click)="closeOnBackdrop($event)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ editingId ? 'Editar consulta' : 'Nova consulta' }}</h3>
              <p>Preencha os dados do agendamento</p>
            </div>
            <button class="btn btn-icon" (click)="showModal=false" aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form class="form" (ngSubmit)="save()">
            <div class="form-group">
              <label>Paciente *</label>
              <select class="select" [(ngModel)]="form.patientId" name="patientId" required>
                <option value="">Selecione o paciente</option>
                @for (p of patients; track p.id) {
                  <option [value]="p.id">{{ p.name }}</option>
                }
              </select>
            </div>
            @if (!isDentist && dentists.length > 0) {
              <div class="form-group">
                <label>Dentista responsável</label>
                <select class="select" [(ngModel)]="form.dentistId" name="dentistId">
                  <option value="">Sem dentista definido</option>
                  @for (d of dentists; track d.id) {
                    <option [value]="d.id">{{ d.name }}</option>
                  }
                </select>
              </div>
            }
            <div class="grid cols-2">
              <div class="form-group">
                <label>Início *</label>
                <input class="input" [(ngModel)]="form.startTime" name="startTime" type="datetime-local" required />
              </div>
              <div class="form-group">
                <label>Término *</label>
                <input class="input" [(ngModel)]="form.endTime" name="endTime" type="datetime-local" required />
              </div>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select class="select" [(ngModel)]="form.status" name="status">
                <option value="SCHEDULED">Agendado</option>
                <option value="COMPLETED">Concluído</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div class="form-group">
              <label>Observações</label>
              <textarea class="textarea" [(ngModel)]="form.notes" name="notes" placeholder="Notas sobre a consulta..." rows="3"></textarea>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" type="button" (click)="showModal=false">Cancelar</button>
              <button class="btn btn-primary" [disabled]="saving" type="submit">
                @if (saving) { <span class="spinner"></span> }
                {{ editingId ? 'Salvar alterações' : 'Agendar consulta' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete Confirm -->
    @if (deleteTarget) {
      <div class="modal-backdrop" (click)="deleteTarget=null">
        <div class="modal" style="max-width:400px;" (click)="$event.stopPropagation()">
          <div style="text-align:center;padding:8px 0 16px;">
            <div style="width:48px;height:48px;background:var(--danger-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--danger);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h3 style="font-size:17px;font-weight:700;margin-bottom:8px;">Cancelar consulta?</h3>
            <p style="color:var(--muted);font-size:14px;">O agendamento de <strong style="color:var(--text);">{{ deleteTarget.patient?.name }}</strong> será removido.</p>
          </div>
          <div style="display:flex;gap:10px;margin-top:16px;">
            <button class="btn btn-ghost" style="flex:1;" (click)="deleteTarget=null">Voltar</button>
            <button class="btn btn-danger" style="flex:1;" [disabled]="saving" (click)="doDelete()">
              @if (saving) { <span class="spinner"></span> } Confirmar
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class AppointmentsComponent implements OnInit {
  appointments: Appointment[] = []
  patients: Patient[] = []
  dentists: Dentist[] = []
  filterStatus = 'ALL'
  dentistFilter = ''
  view: 'week' | 'list' = 'week'
  loading = false
  saving = false
  showModal = false
  editingId: string | null = null
  deleteTarget: Appointment | null = null
  form: Partial<Appointment> & { notes?: string } = {}

  weekStart = startOfWeek(new Date())
  readonly hours: number[] = []
  readonly pxPerHour = PX_PER_HOUR
  readonly gridHeight = (GRID_END_HOUR - GRID_START_HOUR) * PX_PER_HOUR
  readonly DAY_LABELS = DAY_LABELS
  readonly STATUS_LABELS = STATUS_LABELS
  readonly STATUS_CLASS = STATUS_CLASS
  readonly statusOpts = [
    { value: 'ALL', label: 'Todos' },
    { value: 'SCHEDULED', label: 'Agendados' },
    { value: 'COMPLETED', label: 'Concluídos' },
    { value: 'CANCELLED', label: 'Cancelados' },
  ]

  isDentist = false

  constructor(private http: HttpClient, private toast: ToastService, private auth: AuthService) {
    for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) this.hours.push(h)
    this.isDentist = this.auth.isDentist()
  }

  ngOnInit() {
    this.loadPatients()
    if (!this.isDentist) this.loadDentists()
    this.load()
  }

  get weekDays() {
    return Array.from({ length: 7 }, (_, i) => addDays(this.weekStart, i))
  }

  get rangeLabel() {
    const end = addDays(this.weekStart, 6)
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    return `${fmt(this.weekStart)} – ${fmt(end)}${this.weekStart.getFullYear() !== new Date().getFullYear() ? ' de ' + this.weekStart.getFullYear() : ''}`
  }

  get filtered() {
    return this.appointments
  }

  get statusFiltered() {
    if (this.filterStatus === 'ALL') return this.appointments
    return this.appointments.filter(a => a.status === this.filterStatus)
  }

  isToday(d: Date) {
    return sameDay(d, new Date())
  }

  dentistColor(idx: number) {
    return DENTIST_PALETTE[idx] || DENTIST_PALETTE[0]
  }

  duration(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const m = Math.round(diff / 60000)
    if (m < 60) return `${m}min`
    const h = Math.floor(m / 60), rm = m % 60
    return rm > 0 ? `${h}h${rm}min` : `${h}h`
  }

  setView(v: 'week' | 'list') {
    if (this.view === v) return
    this.view = v
    this.load()
  }

  shiftWeek(dir: number) {
    this.weekStart = addDays(this.weekStart, dir * 7)
    this.load()
  }

  goToday() {
    this.weekStart = startOfWeek(new Date())
    this.load()
  }

  loadPatients() {
    this.http.get<Patient[]>('/api/patients').subscribe({ next: res => this.patients = res })
  }

  loadDentists() {
    this.http.get<Dentist[]>('/api/users?role=DENTIST').subscribe({ next: res => this.dentists = res })
  }

  load() {
    this.loading = true
    let url = '/api/appointments'
    const params: string[] = []
    if (this.view === 'week') {
      const from = this.weekStart
      const to = addDays(this.weekStart, 7)
      params.push(`from=${from.toISOString()}`, `to=${to.toISOString()}`)
    }
    if (this.dentistFilter) params.push(`dentistId=${this.dentistFilter}`)
    if (params.length) url += '?' + params.join('&')
    this.http.get<Appointment[]>(url).subscribe({
      next: res => { this.appointments = res; this.loading = false },
      error: () => { this.loading = false; this.toast.error('Falha ao carregar agenda') }
    })
  }

  /** Distribui os agendamentos do dia em "colunas" para não sobrepor visualmente os que colidem no horário. */
  blocksByDay(day: Date): CalendarBlock[] {
    const dayItems = this.appointments
      .filter(a => sameDay(new Date(a.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    if (!dayItems.length) return []

    const columnEnds: number[] = []
    const columnOf = new Map<string, number>()
    for (const a of dayItems) {
      const start = new Date(a.startTime).getTime()
      const end = new Date(a.endTime).getTime()
      let col = columnEnds.findIndex(e => e <= start)
      if (col === -1) { col = columnEnds.length; columnEnds.push(end) } else { columnEnds[col] = end }
      columnOf.set(a.id, col)
    }
    const totalCols = Math.max(1, columnEnds.length)

    return dayItems.map(a => {
      const start = new Date(a.startTime)
      const end = new Date(a.endTime)
      const startMin = (start.getHours() - GRID_START_HOUR) * 60 + start.getMinutes()
      const endMin = (end.getHours() - GRID_START_HOUR) * 60 + end.getMinutes()
      const top = Math.max(0, (startMin / 60) * PX_PER_HOUR)
      const height = Math.max(22, ((endMin - startMin) / 60) * PX_PER_HOUR)
      const col = columnOf.get(a.id) || 0
      return {
        ...a,
        top, height,
        left: (col / totalCols) * 100,
        width: (1 / totalCols) * 100 - 1,
        colorIdx: colorIndexFor(a.dentistId)
      }
    })
  }

  onSlotClick(ev: MouseEvent, day: Date) {
    if ((ev.target as HTMLElement).closest('.agenda-block')) return
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
    const y = ev.clientY - rect.top
    const totalMinutes = Math.round((y / PX_PER_HOUR) * 60 / 15) * 15
    const start = new Date(day)
    start.setHours(GRID_START_HOUR, 0, 0, 0)
    start.setMinutes(start.getMinutes() + Math.max(0, totalMinutes))
    const end = new Date(start.getTime() + 60 * 60000)
    this.openCreate(start, end)
  }

  onBlockClick(ev: MouseEvent, block: CalendarBlock) {
    ev.stopPropagation()
    this.openEdit(block)
  }

  openCreate(start?: Date, end?: Date) {
    this.editingId = null
    this.form = {
      status: 'SCHEDULED',
      startTime: start ? toLocalInput(start) : undefined,
      endTime: end ? toLocalInput(end) : undefined
    }
    this.showModal = true
  }

  openEdit(a: Appointment) {
    this.editingId = a.id
    this.form = {
      patientId: a.patientId,
      dentistId: a.dentistId || '',
      startTime: this.toLocal(a.startTime),
      endTime: this.toLocal(a.endTime),
      status: a.status,
      notes: a.notes,
    }
    this.showModal = true
  }

  private toLocal(iso: string) {
    return toLocalInput(new Date(iso))
  }

  save() {
    this.saving = true
    const body: Record<string, unknown> = {
      patientId: this.form.patientId,
      startTime: new Date(this.form.startTime!).toISOString(),
      endTime: new Date(this.form.endTime!).toISOString(),
      status: this.form.status || 'SCHEDULED',
      notes: this.form.notes || undefined,
    }
    if (!this.isDentist) body.dentistId = this.form.dentistId || null
    const req = this.editingId
      ? this.http.put(`/api/appointments/${this.editingId}`, body)
      : this.http.post('/api/appointments', body)
    req.subscribe({
      next: () => {
        this.saving = false; this.showModal = false
        this.toast.success(this.editingId ? 'Consulta atualizada' : 'Consulta agendada com sucesso')
        this.load()
      },
      error: (err: any) => { this.saving = false; this.toast.error('Erro ao salvar', err.error?.message) }
    })
  }

  confirmDelete(a: Appointment) { this.deleteTarget = a }

  doDelete() {
    if (!this.deleteTarget) return
    this.saving = true
    this.http.delete(`/api/appointments/${this.deleteTarget.id}`).subscribe({
      next: () => { this.saving = false; this.deleteTarget = null; this.toast.success('Consulta removida'); this.load() },
      error: (err: any) => { this.saving = false; this.toast.error('Erro ao remover', err.error?.message) }
    })
  }

  closeOnBackdrop(ev: MouseEvent) {
    if ((ev.target as HTMLElement).classList.contains('modal-backdrop')) this.showModal = false
  }
}
