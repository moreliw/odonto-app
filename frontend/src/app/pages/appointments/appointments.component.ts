import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'
import { AuthService } from '../../services/auth.service'
import { SearchableSelectComponent } from '../../components/searchable-select/searchable-select.component'

type Patient = { id: string; name: string; email?: string | null }
type Dentist = { id: string; name: string }
type Appointment = {
  id: string
  patientId: string
  patient?: Patient
  dentistId?: string | null
  dentist?: Dentist | null
  /** Nome do dentista sem conta no sistema (só quando dentistId é nulo). */
  dentistName?: string | null
  startTime: string
  endTime: string
  status: string
  notes?: string
  confirmationStatus?: 'PENDING' | 'CONFIRMED' | 'DECLINED'
  confirmationSentAt?: string | null
  confirmationToken?: string | null
}
type CalendarBlock = Appointment & { top: number; height: number; left: number; width: number; colorIdx: number }

const STATUS_LABELS: Record<string, string> = { SCHEDULED: 'Agendado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }
const STATUS_CLASS: Record<string, string> = { SCHEDULED: 'blue', COMPLETED: '', CANCELLED: 'neutral' }

/** "Não enviado" até o e-mail sair; depois disso reflete a resposta do paciente (ou "Aguardando" enquanto não responde). */
function confirmationLabel(a: Pick<Appointment, 'confirmationSentAt' | 'confirmationStatus'>) {
  if (!a.confirmationSentAt) return 'Não enviado'
  if (a.confirmationStatus === 'CONFIRMED') return 'Confirmada'
  if (a.confirmationStatus === 'DECLINED') return 'Recusada'
  return 'Aguardando resposta'
}
function confirmationClass(a: Pick<Appointment, 'confirmationSentAt' | 'confirmationStatus'>) {
  if (!a.confirmationSentAt) return 'neutral'
  if (a.confirmationStatus === 'CONFIRMED') return ''
  if (a.confirmationStatus === 'DECLINED') return 'late'
  return 'pending'
}
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
    imports: [CommonModule, FormsModule, SearchableSelectComponent],
    template: `
    <div class="agenda-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Agenda</h1>
          <p>{{ isDentist ? 'Seus atendimentos agendados' : 'Consultas e procedimentos agendados' }}</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-outline" [disabled]="sendingBulkConfirmations" (click)="sendBulkConfirmations()" title="Envia e-mail de confirmação para as consultas agendadas da semana que ainda não receberam pedido">
            @if (sendingBulkConfirmations) { <span class="spinner spinner-dark"></span> } @else {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>
            }
            Enviar confirmações da semana
          </button>
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
          <div class="agenda-dentist-filter">
            <app-searchable-select
              [items]="dentistItems"
              clearLabel="Todos os dentistas"
              placeholder="Todos os dentistas"
              searchPlaceholder="Buscar dentista..."
              ariaLabel="Filtrar por dentista"
              [(ngModel)]="dentistFilter"
              (ngModelChange)="load()"
            ></app-searchable-select>
          </div>
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
                        [style.border-left-color]="!isDentist && (block.dentist || block.dentistName) ? dentistColor(block.colorIdx) : null"
                        (click)="onBlockClick($event, block)"
                        [title]="(block.patient?.name || 'Paciente') + ' · ' + (block.startTime | date:'HH:mm') + '–' + (block.endTime | date:'HH:mm') + ((block.dentist?.name || block.dentistName) ? ' · ' + (block.dentist?.name || block.dentistName) : '') + ' · ' + confirmationLabel(block)"
                      >
                        @if (block.confirmationStatus === 'CONFIRMED') {
                          <span class="agenda-block-confirm confirmed" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span>
                        } @else if (block.confirmationStatus === 'DECLINED') {
                          <span class="agenda-block-confirm declined" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m18 6-12 12M6 6l12 12"/></svg></span>
                        }
                        <strong>{{ block.patient?.name || 'Paciente' }}</strong>
                        <span>{{ block.startTime | date:'HH:mm' }}–{{ block.endTime | date:'HH:mm' }}</span>
                        @if (!isDentist && (block.dentist || block.dentistName)) { <em>{{ block.dentist?.name || block.dentistName }}</em> }
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
                  <th>Confirmação</th>
                  <th>Obs.</th>
                  <th style="width:110px;"></th>
                </tr>
              </thead>
              <tbody>
                @if (loading) {
                  <tr><td [attr.colspan]="isDentist ? 7 : 8" class="table-empty"><span class="spinner spinner-dark"></span></td></tr>
                } @else if (statusFiltered.length === 0) {
                  <tr><td [attr.colspan]="isDentist ? 7 : 8">
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
                      @if (!isDentist) { <td class="muted text-sm">{{ a.dentist?.name || a.dentistName || '—' }}</td> }
                      <td>
                        <div style="font-weight:500;">{{ a.startTime | date:'dd/MM/yyyy' }}</div>
                        <div class="text-xs muted">{{ a.startTime | date:'HH:mm' }}</div>
                      </td>
                      <td class="muted text-sm">{{ duration(a.startTime, a.endTime) }}</td>
                      <td><span class="status-chip" [class]="STATUS_CLASS[a.status]">{{ STATUS_LABELS[a.status] || a.status }}</span></td>
                      <td>
                        <span class="status-chip" [class]="confirmationClass(a)">{{ confirmationLabel(a) }}</span>
                      </td>
                      <td class="muted text-sm" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ a.notes || '—' }}</td>
                      <td>
                        <div class="table-actions">
                          @if (a.status === 'SCHEDULED') {
                            <button class="btn btn-sm btn-ghost" [disabled]="sendingConfirmationId === a.id" (click)="sendConfirmation(a)" [title]="a.confirmationSentAt ? 'Reenviar confirmação' : 'Enviar confirmação'">
                              @if (sendingConfirmationId === a.id) { <span class="spinner spinner-dark"></span> } @else {
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>
                              }
                            </button>
                            <button class="btn btn-sm btn-ghost" (click)="copyConfirmationLink(a)" title="Copiar link de confirmação">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                          }
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
              <app-searchable-select
                [items]="patientItems"
                placeholder="Selecione o paciente"
                searchPlaceholder="Buscar paciente..."
                ariaLabel="Paciente"
                [(ngModel)]="form.patientId"
                name="patientId"
                required
                [allowCreate]="true"
                createLabel="Cadastrar novo paciente"
                (createRequested)="openQuickCreatePatient($event)"
              ></app-searchable-select>
            </div>
            @if (!isDentist) {
              <div class="form-group">
                <label>Dentista responsável <span class="muted" style="font-weight:400;">(opcional)</span></label>
                <app-searchable-select
                  [items]="dentistItems"
                  clearLabel="Sem dentista definido"
                  placeholder="Sem dentista definido"
                  searchPlaceholder="Buscar dentista..."
                  ariaLabel="Dentista responsável"
                  [(ngModel)]="form.dentistId"
                  name="dentistId"
                  (ngModelChange)="onDentistIdChange($event)"
                ></app-searchable-select>
                @if (!form.dentistId) {
                  <div style="margin-top:8px;">
                    <input
                      class="input"
                      [(ngModel)]="form.dentistName"
                      name="dentistName"
                      placeholder="Ou digite o nome (sem conta no sistema)"
                      (ngModelChange)="onDentistNameChange($event)"
                    />
                    <small class="muted">Use quando o profissional não tem login no sistema — fica só como referência no agendamento.</small>
                  </div>
                }
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

    <!-- Quick create patient (sem sair do agendamento) -->
    @if (quickPatientModal) {
      <div class="modal-backdrop" (click)="closeQuickPatientOnBackdrop($event)">
        <div class="modal" style="max-width:420px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Cadastrar paciente</h3>
              <p>Cadastro rápido — complete os demais dados depois em Pacientes</p>
            </div>
            <button class="btn btn-icon" (click)="quickPatientModal=false" aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form class="form" (ngSubmit)="saveQuickPatient()">
            <div class="form-group">
              <label>Nome completo *</label>
              <input class="input" [(ngModel)]="quickPatientForm.name" name="qp_name" placeholder="Nome do paciente" required />
            </div>
            <div class="form-group">
              <label>Telefone</label>
              <input class="input" [(ngModel)]="quickPatientForm.phone" name="qp_phone" placeholder="(11) 99999-9999" />
            </div>
            <div class="form-group">
              <label>E-mail</label>
              <input class="input" [(ngModel)]="quickPatientForm.email" name="qp_email" type="email" placeholder="email@exemplo.com" />
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" type="button" (click)="quickPatientModal=false">Cancelar</button>
              <button class="btn btn-primary" [disabled]="savingQuickPatient" type="submit">
                @if (savingQuickPatient) { <span class="spinner"></span> }
                Cadastrar e selecionar
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
  quickPatientModal = false
  savingQuickPatient = false
  quickPatientForm: { name: string; phone: string; email: string } = { name: '', phone: '', email: '' }
  sendingConfirmationId: string | null = null
  sendingBulkConfirmations = false

  weekStart = startOfWeek(new Date())
  readonly hours: number[] = []
  readonly pxPerHour = PX_PER_HOUR
  readonly gridHeight = (GRID_END_HOUR - GRID_START_HOUR) * PX_PER_HOUR
  readonly DAY_LABELS = DAY_LABELS
  readonly STATUS_LABELS = STATUS_LABELS
  readonly STATUS_CLASS = STATUS_CLASS
  readonly confirmationLabel = confirmationLabel
  readonly confirmationClass = confirmationClass
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

  get patientItems() {
    return this.patients.map(p => ({ id: p.id, label: p.name }))
  }

  get dentistItems() {
    return this.dentists.map(d => ({ id: d.id, label: d.name }))
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

  openQuickCreatePatient(searchText: string) {
    this.quickPatientForm = { name: searchText, phone: '', email: '' }
    this.quickPatientModal = true
  }

  saveQuickPatient() {
    if (!this.quickPatientForm.name.trim() || this.savingQuickPatient) return
    this.savingQuickPatient = true
    const body = {
      name: this.quickPatientForm.name.trim(),
      phone: this.quickPatientForm.phone.trim() || undefined,
      email: this.quickPatientForm.email.trim() || undefined
    }
    this.http.post<Patient>('/api/patients', body).subscribe({
      next: patient => {
        this.savingQuickPatient = false
        this.quickPatientModal = false
        this.patients = [...this.patients, patient]
        this.form.patientId = patient.id
        this.toast.success('Paciente cadastrado e selecionado')
      },
      error: (err: any) => {
        this.savingQuickPatient = false
        this.toast.error('Erro ao cadastrar paciente', err.error?.message)
      }
    })
  }

  closeQuickPatientOnBackdrop(ev: MouseEvent) {
    if ((ev.target as HTMLElement).classList.contains('modal-backdrop')) this.quickPatientModal = false
  }

  confirmationLink(a: Appointment) {
    if (!a.confirmationToken) return ''
    const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || ''
    return `${location.origin}/confirmar/${tenant}/${a.confirmationToken}`
  }

  copyConfirmationLink(a: Appointment) {
    const link = this.confirmationLink(a)
    if (!link) return
    navigator.clipboard.writeText(link).then(
      () => this.toast.success('Link de confirmação copiado'),
      () => this.toast.error('Não foi possível copiar o link')
    )
  }

  sendConfirmation(a: Appointment) {
    if (this.sendingConfirmationId) return
    this.sendingConfirmationId = a.id
    this.http.post<{ ok: boolean; emailed: boolean; link: string }>(`/api/appointments/${a.id}/send-confirmation`, {}).subscribe({
      next: res => {
        this.sendingConfirmationId = null
        if (res.emailed) this.toast.success('E-mail de confirmação enviado')
        else this.toast.warning('Paciente sem e-mail cadastrado', 'Use "Copiar link" para enviar por WhatsApp ou SMS.')
        this.load()
      },
      error: (err: any) => {
        this.sendingConfirmationId = null
        this.toast.error('Erro ao enviar confirmação', err.error?.message)
      }
    })
  }

  sendBulkConfirmations() {
    if (this.sendingBulkConfirmations) return
    this.sendingBulkConfirmations = true
    const from = encodeURIComponent(this.weekStart.toISOString())
    const to = encodeURIComponent(addDays(this.weekStart, 7).toISOString())
    this.http.post<{ ok: boolean; sent: number; skippedNoEmail: number; total: number }>(`/api/appointments/send-confirmations?from=${from}&to=${to}`, {}).subscribe({
      next: res => {
        this.sendingBulkConfirmations = false
        if (res.total === 0) this.toast.info('Nenhuma consulta pendente de confirmação nesta semana')
        else {
          this.toast.success(
            `${res.sent} confirmação${res.sent === 1 ? '' : 'ões'} enviada${res.sent === 1 ? '' : 's'}`,
            res.skippedNoEmail ? `${res.skippedNoEmail} paciente${res.skippedNoEmail === 1 ? '' : 's'} sem e-mail cadastrado` : undefined
          )
        }
        this.load()
      },
      error: (err: any) => {
        this.sendingBulkConfirmations = false
        this.toast.error('Erro ao enviar confirmações', err.error?.message)
      }
    })
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
        colorIdx: colorIndexFor(a.dentistId || a.dentistName)
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
      dentistName: a.dentistName || '',
      startTime: this.toLocal(a.startTime),
      endTime: this.toLocal(a.endTime),
      status: a.status,
      notes: a.notes,
    }
    this.showModal = true
  }

  onDentistIdChange(id: string) {
    if (id) this.form.dentistName = ''
  }

  onDentistNameChange(name: string) {
    if (name) this.form.dentistId = ''
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
    if (!this.isDentist) {
      body.dentistId = this.form.dentistId || null
      body.dentistName = this.form.dentistName || null
    }
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
