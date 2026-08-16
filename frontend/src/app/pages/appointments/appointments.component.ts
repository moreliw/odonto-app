import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'
import { AuthService } from '../../services/auth.service'
import { SearchableSelectComponent } from '../../components/searchable-select/searchable-select.component'
import { PaginationComponent } from '../../components/pagination/pagination.component'
import { paginate } from '../../utils/pagination'
import { ActivatedRoute, Router } from '@angular/router'

type Patient = { id: string; name: string; email?: string | null; phone?: string | null }
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
  createdByName?: string | null
  updatedByName?: string | null
  createdAt?: string
  updatedAt?: string
}
type CalendarBlock = Appointment & { top: number; height: number; left: number; width: number; colorIdx: number; compact: boolean }

const STATUS_LABELS: Record<string, string> = { SCHEDULED: 'Agendado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }
const STATUS_CLASS: Record<string, string> = { SCHEDULED: 'blue', COMPLETED: '', CANCELLED: 'neutral' }

function confirmationLabel(a: Pick<Appointment, 'confirmationStatus'>) {
  if (a.confirmationStatus === 'CONFIRMED') return 'Confirmado'
  if (a.confirmationStatus === 'DECLINED') return 'Não confirmado'
  return 'Aguardando confirmação'
}
function confirmationClass(a: Pick<Appointment, 'confirmationStatus'>) {
  if (a.confirmationStatus === 'CONFIRMED') return ''
  if (a.confirmationStatus === 'DECLINED') return 'late'
  return 'pending'
}
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const GRID_START_HOUR = 7
const GRID_END_HOUR = 20
const PX_PER_HOUR = 64
const DENTIST_PALETTE = ['#2563eb', '#14b8a6', '#a855f7', '#f59e0b', '#ec4899', '#22c55e']
const DENTIST_PALETTE_BG = ['#eff6ff', '#f0fdfa', '#faf5ff', '#fffbeb', '#fdf2f8', '#f0fdf4']

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
    imports: [CommonModule, FormsModule, SearchableSelectComponent, PaginationComponent],
    template: `
    <div class="agenda-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Agenda</h1>
          <p>{{ isDentist ? 'Seus atendimentos agendados' : 'Consultas e procedimentos agendados' }}</p>
        </div>
        <div class="page-header-actions">
          @if (!isDentist) {
            <button class="btn btn-primary" (click)="openCreate()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nova consulta
            </button>
          }
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
        <span class="text-sm muted">{{ visibleCount }} consulta{{ visibleCount !== 1 ? 's' : '' }}</span>
      </div>

      @if (view === 'week') {
        <div class="card agenda-calendar">
          @if (loading) {
            <div class="table-empty"><span class="spinner spinner-dark"></span></div>
          } @else {
            <div class="agenda-week-scroll">
              <div class="agenda-week-head">
                <div class="agenda-hour-gutter"></div>
                @for (day of weekDays; track day.getTime()) {
                  <div class="agenda-day-head" [class.is-today]="isToday(day)">
                    <span class="agenda-day-name">{{ DAY_LABELS[day.getDay()] }}</span>
                    <span class="agenda-day-num">{{ day.getDate() }}</span>
                  </div>
                }
              </div>
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
                        [class.compact]="block.compact"
                        [style.top.px]="block.top"
                        [style.height.px]="block.height"
                        [style.left.%]="block.left"
                        [style.width.%]="block.width"
                        [style.border-left-color]="!isDentist && (block.dentist || block.dentistName) ? dentistColor(block.colorIdx) : null"
                        [style.background]="!isDentist && block.status === 'SCHEDULED' && (block.dentist || block.dentistName) ? dentistBg(block.colorIdx) : null"
                        [style.color]="!isDentist && block.status === 'SCHEDULED' && (block.dentist || block.dentistName) ? '#1e293b' : null"
                        (click)="onBlockClick($event, block)"
                        [title]="(block.patient?.name || 'Paciente') + ' · ' + (block.startTime | date:'HH:mm') + '–' + (block.endTime | date:'HH:mm') + ((block.dentist?.name || block.dentistName) ? ' · ' + (block.dentist?.name || block.dentistName) : '') + ' · ' + confirmationLabel(block)"
                      >
                        @if (block.confirmationStatus === 'CONFIRMED') {
                          <span class="agenda-block-confirm confirmed" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span>
                        } @else if (block.confirmationStatus === 'DECLINED') {
                          <span class="agenda-block-confirm declined" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m18 6-12 12M6 6l12 12"/></svg></span>
                        } @else {
                          <span class="agenda-block-confirm pending" aria-hidden="true"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
                        }
                        <strong>{{ block.patient?.name || 'Paciente' }}</strong>
                        @if (block.compact) {
                          <span>{{ block.startTime | date:'HH:mm' }}</span>
                        } @else {
                          <span>{{ block.startTime | date:'HH:mm' }}–{{ block.endTime | date:'HH:mm' }}</span>
                          @if (!isDentist && (block.dentist || block.dentistName)) { <em>{{ block.dentist?.name || block.dentistName }}</em> }
                        }
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        @if (activeDashboardFilterLabel) {
          <div class="agenda-context-filter" role="status">
            <div>
              <strong>Filtro da dashboard</strong>
              <span>{{ activeDashboardFilterLabel }}</span>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" (click)="clearDashboardFilters()">Limpar filtro</button>
          </div>
        }

        <div class="card" style="padding:14px 20px;margin-bottom:16px;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            @for (opt of statusOpts; track opt.value) {
              <button
                class="btn btn-sm"
                [class.btn-primary]="filterStatus === opt.value"
                [class.btn-ghost]="filterStatus !== opt.value"
                (click)="filterStatus = opt.value; listPage = 1"
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
                  @if (isAdmin) {
                    <th class="text-center">Criado por</th>
                    <th class="text-center">Atualizado por</th>
                  }
                  <th>Obs.</th>
                  <th style="width:110px;"></th>
                </tr>
              </thead>
              <tbody>
                @if (loading) {
                  <tr><td [attr.colspan]="appointmentColspan" class="table-empty"><span class="spinner spinner-dark"></span></td></tr>
                } @else if (statusFiltered.length === 0) {
                  <tr><td [attr.colspan]="appointmentColspan">
                    <div class="empty-state">
                      <div class="empty-state-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <h3>Nenhuma consulta encontrada</h3>
                      <p>{{ activeDashboardFilterLabel ? 'Nenhuma consulta corresponde a este filtro' : (filterStatus !== 'ALL' ? 'Tente outro filtro de status' : 'Clique em "Nova consulta" para agendar') }}</p>
                    </div>
                  </td></tr>
                } @else {
                  @for (a of pagedAppointments; track a.id) {
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
                      @if (isAdmin) {
                        <td class="text-center"><div class="audit-cell audit-cell--center"><strong>{{ a.createdByName || 'Sistema' }}</strong><span>{{ a.createdAt | date:'dd/MM/yyyy HH:mm' }}</span></div></td>
                        <td class="text-center"><div class="audit-cell audit-cell--center"><strong>{{ a.updatedByName || a.createdByName || 'Sistema' }}</strong><span>{{ a.updatedAt | date:'dd/MM/yyyy HH:mm' }}</span></div></td>
                      }
                      <td class="muted text-sm" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ a.notes || '—' }}</td>
                      <td>
                        <div class="table-actions">
                          @if (a.status === 'SCHEDULED') {
                            <button class="btn btn-sm btn-ghost whatsapp-action" [disabled]="sendingConfirmationId === a.id" (click)="openWhatsappConfirmation(a)" title="Abrir mensagem no WhatsApp">
                              @if (sendingConfirmationId === a.id) { <span class="spinner spinner-dark"></span> } @else {
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6A8.38 8.38 0 0 1 12.5 3h.5a8.48 8.48 0 0 1 8 8z"/><path d="M8.8 8.6c.3 2.9 2.6 5.2 5.5 5.5"/></svg>
                              }
                            </button>
                            <button class="btn btn-sm btn-ghost" (click)="copyConfirmationLink(a)" title="Copiar link de confirmação">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                          }
                          <button class="btn btn-sm btn-ghost" (click)="openEdit(a)" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button class="btn btn-sm btn-ghost" style="color:var(--danger);" (click)="confirmDelete(a)" title="Excluir consulta">
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
          <app-pagination [page]="listPage" [pageSize]="listPageSize" [totalItems]="statusFiltered.length" (pageChange)="listPage=$event"></app-pagination>
        </div>
      }
    </div>

    <!-- Create / Edit Modal -->
    @if (showModal) {
      <div class="modal-backdrop" (click)="closeOnBackdrop($event)">
        <div class="modal appointment-edit-modal" (click)="$event.stopPropagation()">
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
              @if (isDentist) {
                <input class="input" [value]="editingAppointment?.patient?.name || 'Paciente'" readonly aria-label="Paciente da consulta" />
              } @else {
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
              }
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
                  [allowCreate]="true"
                  createLabel="Cadastrar novo dentista"
                  (createRequested)="openQuickCreateDentist($event)"
                ></app-searchable-select>
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
            @if (editingId) {
              <fieldset class="confirmation-fieldset">
                <legend>Confirmação do paciente</legend>
                <p>Consulte a resposta recebida ou altere o status manualmente.</p>
                <div class="confirmation-options">
                  <label class="confirmation-option confirmation-option--pending" [class.active]="form.confirmationStatus === 'PENDING'">
                    <input type="radio" [(ngModel)]="form.confirmationStatus" name="confirmationStatus" value="PENDING" />
                    <span class="confirmation-option-icon" aria-hidden="true">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                    </span>
                    <span><strong>Aguardando</strong><small>Sem resposta</small></span>
                  </label>
                  <label class="confirmation-option confirmation-option--declined" [class.active]="form.confirmationStatus === 'DECLINED'">
                    <input type="radio" [(ngModel)]="form.confirmationStatus" name="confirmationStatus" value="DECLINED" />
                    <span class="confirmation-option-icon" aria-hidden="true">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="m18 6-12 12M6 6l12 12"/></svg>
                    </span>
                    <span><strong>Não confirmado</strong><small>Não comparecerá</small></span>
                  </label>
                  <label class="confirmation-option confirmation-option--confirmed" [class.active]="form.confirmationStatus === 'CONFIRMED'">
                    <input type="radio" [(ngModel)]="form.confirmationStatus" name="confirmationStatus" value="CONFIRMED" />
                    <span class="confirmation-option-icon" aria-hidden="true">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                    <span><strong>Confirmado</strong><small>Presença confirmada</small></span>
                  </label>
                </div>
              </fieldset>
            }
            <div class="form-group">
              <label>Observações</label>
              <textarea class="textarea" [(ngModel)]="form.notes" name="notes" placeholder="Notas sobre a consulta..." rows="3"></textarea>
            </div>
            @if (editingId) {
              <div class="appointment-context-actions" aria-label="Ações da consulta">
                <button class="btn btn-outline" type="button" [disabled]="saving" (click)="openPatientRecord()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>
                  Adicionar ao prontuário
                </button>
                @if (editingAppointment?.status === 'SCHEDULED') {
                  <button class="btn btn-outline whatsapp-action" type="button" [disabled]="saving || sendingConfirmationId === editingId" (click)="openWhatsappConfirmation(editingAppointment!)">
                    @if (sendingConfirmationId === editingId) { <span class="spinner spinner-dark"></span> } @else {
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6A8.38 8.38 0 0 1 12.5 3h.5a8.48 8.48 0 0 1 8 8z"/><path d="M8.8 8.6c.3 2.9 2.6 5.2 5.5 5.5"/></svg>
                    }
                    Abrir WhatsApp
                  </button>
                }
              </div>
            }
            <div class="modal-footer appointment-edit-footer">
              @if (editingId) {
                <button class="btn btn-danger-outline" type="button" [disabled]="saving || deleting" (click)="requestDeleteFromEdit()">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  Excluir consulta
                </button>
              }
              <div class="modal-footer-main">
                <button class="btn btn-ghost" type="button" (click)="showModal=false">Cancelar</button>
                <button class="btn btn-primary" [disabled]="saving" type="submit">
                @if (saving) { <span class="spinner"></span> }
                {{ editingId ? 'Salvar alterações' : 'Agendar consulta' }}
                </button>
              </div>
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

    <!-- Quick create dentist (sem sair do agendamento) -->
    @if (quickDentistModal) {
      <div class="modal-backdrop" (click)="closeQuickDentistOnBackdrop($event)">
        <div class="modal" style="max-width:420px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Cadastrar dentista</h3>
              <p>Cadastro rápido — o acesso ao sistema é opcional</p>
            </div>
            <button class="btn btn-icon" (click)="quickDentistModal=false" aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form class="form" (ngSubmit)="saveQuickDentist()">
            <div class="form-group">
              <label>Nome completo *</label>
              <input class="input" [(ngModel)]="quickDentistForm.name" name="qd_name" placeholder="Nome do dentista" required />
            </div>
            <label class="master-check-row">
              <input type="checkbox" [(ngModel)]="quickDentistForm.withLogin" name="qd_with_login" />
              <span><strong>Criar acesso ao sistema</strong><small>Permite que este dentista faça login. Se deixar desmarcado, o nome fica só como referência na agenda.</small></span>
            </label>
            @if (quickDentistForm.withLogin) {
              <div class="form-group">
                <label>E-mail *</label>
                <input class="input" [(ngModel)]="quickDentistForm.email" name="qd_email" type="email" placeholder="email@clinica.com" [required]="quickDentistForm.withLogin" />
              </div>
              <div class="form-group">
                <label>Senha *</label>
                <div class="input-wrapper">
                  <input
                    class="input"
                    [(ngModel)]="quickDentistForm.password"
                    name="qd_password"
                    [type]="showQuickDentistPwd ? 'text' : 'password'"
                    minlength="8"
                    [required]="quickDentistForm.withLogin"
                    placeholder="Mínimo 8 caracteres"
                    style="padding-right:42px;"
                  />
                  <button type="button" class="input-action" (click)="showQuickDentistPwd = !showQuickDentistPwd" [attr.aria-label]="showQuickDentistPwd ? 'Ocultar senha' : 'Mostrar senha'">
                    @if (showQuickDentistPwd) {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    } @else {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
            }
            <div class="modal-footer">
              <button class="btn btn-ghost" type="button" (click)="quickDentistModal=false">Cancelar</button>
              <button class="btn btn-primary" [disabled]="savingQuickDentist" type="submit">
                @if (savingQuickDentist) { <span class="spinner"></span> }
                {{ quickDentistForm.withLogin ? 'Cadastrar e dar acesso' : 'Cadastrar e selecionar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete Confirm -->
    @if (deleteTarget) {
      <div class="modal-backdrop" (click)="cancelDelete()">
        <div class="modal appointment-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-appointment-title" aria-describedby="delete-appointment-description" (click)="$event.stopPropagation()">
          <div class="appointment-delete-heading">
            <div class="appointment-delete-icon" aria-hidden="true">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </div>
            <div>
              <h3 id="delete-appointment-title">Excluir consulta?</h3>
              <p id="delete-appointment-description">Esta ação é permanente e não poderá ser desfeita.</p>
            </div>
          </div>

          <div class="appointment-delete-summary">
            <strong>{{ deleteTarget.patient?.name || 'Paciente' }}</strong>
            <span>{{ deleteTarget.startTime | date:'dd/MM/yyyy' }} às {{ deleteTarget.startTime | date:'HH:mm' }}</span>
            @if (deleteTarget.dentist?.name || deleteTarget.dentistName) {
              <span>Com {{ deleteTarget.dentist?.name || deleteTarget.dentistName }}</span>
            }
          </div>

          <div class="appointment-delete-actions">
            <button class="btn btn-outline" [disabled]="deleting" (click)="cancelDelete()">Manter consulta</button>
            <button class="btn btn-danger" [disabled]="deleting" (click)="doDelete()">
              @if (deleting) { <span class="spinner"></span> }
              {{ deleting ? 'Excluindo...' : 'Excluir consulta' }}
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
  dashboardRange: 'today' | 'next7' | 'week' | 'month' | '' = ''
  confirmationFilter: 'PENDING' | 'CONFIRMED' | 'DECLINED' | '' = ''
  unassignedOnly = false
  dentistFilter = ''
  view: 'week' | 'list' = 'week'
  loading = false
  saving = false
  deleting = false
  showModal = false
  editingId: string | null = null
  editingAppointment: Appointment | null = null
  deleteTarget: Appointment | null = null
  deleteReturnToEdit = false
  form: Partial<Appointment> & { notes?: string } = {}
  quickPatientModal = false
  savingQuickPatient = false
  quickPatientForm: { name: string; phone: string; email: string } = { name: '', phone: '', email: '' }
  quickDentistModal = false
  savingQuickDentist = false
  showQuickDentistPwd = false
  quickDentistForm: { name: string; withLogin: boolean; email: string; password: string } = { name: '', withLogin: false, email: '', password: '' }
  sendingConfirmationId: string | null = null
  listPage = 1
  readonly listPageSize = 15

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
  isAdmin = false

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) this.hours.push(h)
    this.isDentist = this.auth.isDentist()
    this.isAdmin = this.auth.isAdmin()
  }

  ngOnInit() {
    this.applyRouteFilters()
    this.loadPatients()
    if (!this.isDentist) this.loadDentists()
    this.load()
    if (!this.isDentist && this.route.snapshot.queryParamMap.get('new') === '1') {
      queueMicrotask(() => this.openCreate())
    }
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
    return this.appointments.filter(a => {
      if (this.filterStatus !== 'ALL' && a.status !== this.filterStatus) return false
      if (this.confirmationFilter && (a.confirmationStatus || 'PENDING') !== this.confirmationFilter) return false
      if (this.unassignedOnly && (a.dentistId || a.dentist?.id || a.dentistName)) return false
      if ((this.confirmationFilter || this.unassignedOnly) && new Date(a.startTime).getTime() < Date.now()) return false
      return this.matchesDashboardRange(a)
    })
  }

  get activeDashboardFilterLabel() {
    const labels: string[] = []
    if (this.dashboardRange === 'today') labels.push('Consultas de hoje')
    if (this.dashboardRange === 'next7') labels.push('Próximos 7 dias')
    if (this.dashboardRange === 'week') labels.push('Consultas desta semana')
    if (this.dashboardRange === 'month') labels.push('Consultas deste mês')
    if (this.confirmationFilter === 'PENDING') labels.push('Aguardando confirmação')
    if (this.confirmationFilter === 'CONFIRMED') labels.push('Confirmadas pelo paciente')
    if (this.confirmationFilter === 'DECLINED') labels.push('Não confirmadas pelo paciente')
    if (this.unassignedOnly) labels.push('Sem dentista responsável')
    return labels.join(' · ')
  }

  get pagedAppointments() {
    return paginate(this.statusFiltered, this.listPage, this.listPageSize)
  }

  get visibleCount() {
    return this.view === 'list' ? this.statusFiltered.length : this.filtered.length
  }

  get appointmentColspan() {
    return 7 + (this.isDentist ? 0 : 1) + (this.isAdmin ? 2 : 0)
  }

  clearDashboardFilters() {
    this.dashboardRange = ''
    this.confirmationFilter = ''
    this.unassignedOnly = false
    this.filterStatus = 'ALL'
    this.listPage = 1
    void this.router.navigate([], { relativeTo: this.route, queryParams: { view: 'list' }, replaceUrl: true })
  }

  private applyRouteFilters() {
    const params = this.route.snapshot.queryParamMap
    if (params.get('view') === 'list') this.view = 'list'

    const status = params.get('status')
    if (status && ['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(status)) this.filterStatus = status

    const range = params.get('range')
    if (range && ['today', 'next7', 'week', 'month'].includes(range)) {
      this.dashboardRange = range as typeof this.dashboardRange
    }

    const confirmation = params.get('confirmation')
    if (confirmation && ['PENDING', 'CONFIRMED', 'DECLINED'].includes(confirmation)) {
      this.confirmationFilter = confirmation as typeof this.confirmationFilter
    }
    this.unassignedOnly = params.get('unassigned') === '1'
  }

  private matchesDashboardRange(appointment: Appointment) {
    if (!this.dashboardRange) return true
    const value = new Date(appointment.startTime).getTime()
    const now = new Date()
    let from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let to = addDays(from, 1)

    if (this.dashboardRange === 'next7') {
      from = now
      to = addDays(now, 7)
    }
    if (this.dashboardRange === 'week') {
      from = startOfWeek(now)
      to = addDays(from, 7)
    }
    if (this.dashboardRange === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    }
    return value >= from.getTime() && value < to.getTime()
  }

  isToday(d: Date) {
    return sameDay(d, new Date())
  }

  dentistColor(idx: number) {
    return DENTIST_PALETTE[idx] || DENTIST_PALETTE[0]
  }

  dentistBg(idx: number) {
    return DENTIST_PALETTE_BG[idx] || DENTIST_PALETTE_BG[0]
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
    this.listPage = 1
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

  openQuickCreateDentist(searchText: string) {
    this.quickDentistForm = { name: searchText, withLogin: false, email: '', password: '' }
    this.showQuickDentistPwd = false
    this.quickDentistModal = true
  }

  saveQuickDentist() {
    if (!this.quickDentistForm.name.trim() || this.savingQuickDentist) return
    if (this.quickDentistForm.withLogin && (!this.quickDentistForm.email.trim() || this.quickDentistForm.password.length < 8)) {
      this.toast.error('Informe e-mail e senha (mínimo 8 caracteres) para criar o acesso.')
      return
    }
    this.savingQuickDentist = true
    const body: Record<string, unknown> = { name: this.quickDentistForm.name.trim(), role: 'DENTIST' }
    if (this.quickDentistForm.withLogin) {
      body.email = this.quickDentistForm.email.trim()
      body.password = this.quickDentistForm.password
    }
    this.http.post<Dentist>('/api/users', body).subscribe({
      next: dentist => {
        this.savingQuickDentist = false
        this.quickDentistModal = false
        this.dentists = [...this.dentists, dentist]
        this.form.dentistId = dentist.id
        this.form.dentistName = ''
        this.toast.success(this.quickDentistForm.withLogin ? 'Dentista cadastrado com acesso ao sistema' : 'Dentista cadastrado como referência')
      },
      error: (err: any) => {
        this.savingQuickDentist = false
        this.toast.error('Erro ao cadastrar dentista', err.error?.message)
      }
    })
  }

  closeQuickDentistOnBackdrop(ev: MouseEvent) {
    if ((ev.target as HTMLElement).classList.contains('modal-backdrop')) this.quickDentistModal = false
  }

  confirmationLink(a: Appointment) {
    if (!a.confirmationToken) return ''
    const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || ''
    return `${location.origin}/c/${tenant}/${a.confirmationToken}`
  }

  copyConfirmationLink(a: Appointment) {
    const link = this.confirmationLink(a)
    if (!link) return
    navigator.clipboard.writeText(link).then(
      () => this.toast.success('Link de confirmação copiado'),
      () => this.toast.error('Não foi possível copiar o link')
    )
  }

  openWhatsappConfirmation(a: Appointment) {
    if (this.sendingConfirmationId) return

    const saveCurrentChanges = this.showModal && this.editingId === a.id
    const body = saveCurrentChanges ? this.buildAppointmentBody() : null
    if (saveCurrentChanges && !body) return

    // Abrir a aba dentro do clique evita que navegadores bloqueiem o pop-up depois da chamada HTTP.
    const whatsappWindow = window.open('', '_blank')
    if (whatsappWindow) {
      whatsappWindow.opener = null
      whatsappWindow.document.title = 'Abrindo WhatsApp...'
      whatsappWindow.document.body.textContent = 'Preparando a mensagem no WhatsApp...'
    }

    this.sendingConfirmationId = a.id
    if (saveCurrentChanges && body) {
      this.saving = true
      this.http.put<Appointment>(`/api/appointments/${a.id}`, body).subscribe({
        next: updated => {
          this.saving = false
          this.editingAppointment = updated
          this.prepareWhatsappMessage(updated, whatsappWindow, true)
        },
        error: (err: any) => {
          this.saving = false
          this.sendingConfirmationId = null
          whatsappWindow?.close()
          this.toast.error('Não foi possível salvar a consulta', err.error?.message)
        }
      })
      return
    }

    this.prepareWhatsappMessage(a, whatsappWindow, false)
  }

  private prepareWhatsappMessage(a: Appointment, whatsappWindow: Window | null, changesSaved: boolean) {
    this.http.post<{
      ok: boolean
      whatsappUrl: string
      message: string
      link: string
      appointment: Appointment
    }>(`/api/appointments/${a.id}/prepare-whatsapp`, {}).subscribe({
      next: res => {
        this.sendingConfirmationId = null
        this.editingAppointment = res.appointment
        if (whatsappWindow) whatsappWindow.location.href = res.whatsappUrl
        else window.location.href = res.whatsappUrl
        this.toast.success(
          changesSaved ? 'Consulta atualizada e mensagem pronta' : 'Mensagem pronta no WhatsApp',
          'Revise o texto e clique em Enviar.'
        )
        this.load()
      },
      error: (err: any) => {
        this.sendingConfirmationId = null
        whatsappWindow?.close()
        this.toast.error('Não foi possível abrir o WhatsApp', err.error?.message)
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
      next: res => { this.appointments = res; if (this.view === 'list') this.listPage = 1; this.loading = false },
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
      const rawHeight = ((endMin - startMin) / 60) * PX_PER_HOUR
      // -2px cria um respiro visual entre consultas seguidas (sem isso, back-to-back parece um bloco só).
      const height = Math.max(24, rawHeight - 2)
      const col = columnOf.get(a.id) || 0
      return {
        ...a,
        top, height,
        // Abaixo desse tamanho não cabem 3 linhas (paciente, horário, dentista) sem cortar — esconde a linha do dentista.
        compact: rawHeight < 46,
        left: (col / totalCols) * 100,
        width: (1 / totalCols) * 100 - 1,
        colorIdx: colorIndexFor(a.dentistId || a.dentistName)
      }
    })
  }

  onSlotClick(ev: MouseEvent, day: Date) {
    if (this.isDentist) return
    if ((ev.target as HTMLElement).closest('.agenda-block')) return
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
    const y = ev.clientY - rect.top
    const gridMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60
    const clickedMinutes = (y / PX_PER_HOUR) * 60
    // Cada metade visual da hora representa um intervalo exato de 30 minutos.
    // O floor mantém o horário dentro da faixa efetivamente clicada (ex.: 14:00–14:29 → 14:00).
    const totalMinutes = Math.floor(Math.max(0, Math.min(clickedMinutes, gridMinutes - 30)) / 30) * 30
    const start = new Date(day)
    start.setHours(GRID_START_HOUR, 0, 0, 0)
    start.setMinutes(start.getMinutes() + totalMinutes)
    const end = new Date(start.getTime() + 30 * 60000)
    this.openCreate(start, end)
  }

  onBlockClick(ev: MouseEvent, block: CalendarBlock) {
    ev.stopPropagation()
    this.openEdit(block)
  }

  openCreate(start?: Date, end?: Date) {
    this.editingId = null
    this.editingAppointment = null
    this.form = {
      status: 'SCHEDULED',
      startTime: start ? toLocalInput(start) : undefined,
      endTime: end ? toLocalInput(end) : undefined
    }
    this.showModal = true
  }

  openEdit(a: Appointment) {
    this.editingId = a.id
    this.editingAppointment = a
    this.form = {
      patientId: a.patientId,
      dentistId: a.dentistId || '',
      dentistName: a.dentistName || '',
      startTime: this.toLocal(a.startTime),
      endTime: this.toLocal(a.endTime),
      status: a.status,
      confirmationStatus: a.confirmationStatus || 'PENDING',
      notes: a.notes,
    }
    this.showModal = true
  }

  openPatientRecord() {
    const patientId = this.editingAppointment?.patientId
    if (!patientId) return
    this.showModal = false
    this.router.navigate(['/app/records'], {
      queryParams: { patientId, appointmentId: this.editingAppointment?.id, new: 'evolution' }
    })
  }

  private toLocal(iso: string) {
    return toLocalInput(new Date(iso))
  }

  save() {
    const body = this.buildAppointmentBody()
    if (!body) return
    this.saving = true
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

  private buildAppointmentBody() {
    if (!this.form.patientId || !this.form.startTime || !this.form.endTime) {
      this.toast.error('Preencha paciente, início e término da consulta.')
      return null
    }
    const startTime = new Date(this.form.startTime)
    const endTime = new Date(this.form.endTime)
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
      this.toast.error('Confira os horários da consulta.')
      return null
    }
    const body: Record<string, unknown> = {
      patientId: this.form.patientId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: this.form.status || 'SCHEDULED',
      notes: this.form.notes || undefined,
    }
    if (!this.isDentist) {
      body.dentistId = this.form.dentistId || null
      body.dentistName = this.form.dentistName || null
    }
    if (this.editingId) body.confirmationStatus = this.form.confirmationStatus || 'PENDING'
    return body
  }

  confirmDelete(a: Appointment, returnToEdit = false) {
    this.deleteTarget = a
    this.deleteReturnToEdit = returnToEdit
  }

  requestDeleteFromEdit() {
    if (!this.editingAppointment) return
    this.showModal = false
    this.confirmDelete(this.editingAppointment, true)
  }

  cancelDelete() {
    const returnToEdit = this.deleteReturnToEdit
    this.deleteTarget = null
    this.deleteReturnToEdit = false
    if (returnToEdit && this.editingAppointment) this.showModal = true
  }

  doDelete() {
    if (!this.deleteTarget) return
    this.deleting = true
    this.http.delete(`/api/appointments/${this.deleteTarget.id}`).subscribe({
      next: () => {
        this.deleting = false
        this.deleteTarget = null
        this.deleteReturnToEdit = false
        this.editingId = null
        this.editingAppointment = null
        this.toast.success('Consulta excluída com sucesso')
        this.load()
      },
      error: (err: any) => { this.deleting = false; this.toast.error('Erro ao excluir consulta', err.error?.message) }
    })
  }

  closeOnBackdrop(ev: MouseEvent) {
    if ((ev.target as HTMLElement).classList.contains('modal-backdrop')) this.showModal = false
  }
}
