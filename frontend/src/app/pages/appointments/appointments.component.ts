import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'

type Patient = { id: string; name: string }
type Appointment = { id: string; patientId: string; patient?: Patient; startTime: string; endTime: string; status: string; notes?: string }

const STATUS_LABELS: Record<string, string> = { SCHEDULED: 'Agendado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }
const STATUS_CLASS: Record<string, string> = { SCHEDULED: 'blue', COMPLETED: '', CANCELLED: 'neutral' }

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="page-header">
        <div class="page-header-left">
          <h1>Agenda</h1>
          <p>Consultas e procedimentos agendados</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" (click)="openCreate()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova consulta
          </button>
        </div>
      </div>

      <!-- Status filter -->
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
          <span class="spacer flex flex-1"></span>
          <span class="text-sm muted">{{ filtered.length }} consulta{{ filtered.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Data e hora</th>
                <th>Duração</th>
                <th>Status</th>
                <th>Obs.</th>
                <th style="width:80px;"></th>
              </tr>
            </thead>
            <tbody>
              @if (loading) {
                <tr><td colspan="6" class="table-empty"><span class="spinner spinner-dark"></span></td></tr>
              } @else if (filtered.length === 0) {
                <tr><td colspan="6">
                  <div class="empty-state">
                    <div class="empty-state-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <h3>Nenhuma consulta encontrada</h3>
                    <p>{{ filterStatus !== 'ALL' ? 'Tente outro filtro de status' : 'Clique em "Nova consulta" para agendar' }}</p>
                  </div>
                </td></tr>
              } @else {
                @for (a of filtered; track a.id) {
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px;">
                        <div class="patient-avatar" style="flex-shrink:0;">{{ (a.patient?.name || '?')[0].toUpperCase() }}</div>
                        <span style="font-weight:500;">{{ a.patient?.name || a.patientId }}</span>
                      </div>
                    </td>
                    <td>
                      <div style="font-weight:500;">{{ a.startTime | date:'dd/MM/yyyy' }}</div>
                      <div class="text-xs muted">{{ a.startTime | date:'HH:mm' }}</div>
                    </td>
                    <td class="muted text-sm">{{ duration(a.startTime, a.endTime) }}</td>
                    <td>
                      <span class="status-chip" [class]="STATUS_CLASS[a.status]">{{ STATUS_LABELS[a.status] || a.status }}</span>
                    </td>
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
  filterStatus = 'ALL'
  loading = false
  saving = false
  showModal = false
  editingId: string | null = null
  deleteTarget: Appointment | null = null
  form: Partial<Appointment> & { notes?: string } = {}

  readonly STATUS_LABELS = STATUS_LABELS
  readonly STATUS_CLASS = STATUS_CLASS
  readonly statusOpts = [
    { value: 'ALL', label: 'Todos' },
    { value: 'SCHEDULED', label: 'Agendados' },
    { value: 'COMPLETED', label: 'Concluídos' },
    { value: 'CANCELLED', label: 'Cancelados' },
  ]

  constructor(private http: HttpClient, private toast: ToastService) {}

  ngOnInit() {
    this.loadPatients()
    this.load()
  }

  get filtered() {
    if (this.filterStatus === 'ALL') return this.appointments
    return this.appointments.filter(a => a.status === this.filterStatus)
  }

  duration(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const m = Math.round(diff / 60000)
    if (m < 60) return `${m}min`
    const h = Math.floor(m / 60), rm = m % 60
    return rm > 0 ? `${h}h${rm}min` : `${h}h`
  }

  loadPatients() {
    this.http.get<Patient[]>('/api/patients').subscribe({ next: (res: Patient[]) => this.patients = res })
  }

  load() {
    this.loading = true
    this.http.get<Appointment[]>('/api/appointments').subscribe({
      next: (res: Appointment[]) => { this.appointments = res; this.loading = false },
      error: () => { this.loading = false; this.toast.error('Falha ao carregar agenda') }
    })
  }

  openCreate() {
    this.editingId = null
    this.form = { status: 'SCHEDULED' }
    this.showModal = true
  }

  openEdit(a: Appointment) {
    this.editingId = a.id
    this.form = {
      patientId: a.patientId,
      startTime: this.toLocal(a.startTime),
      endTime: this.toLocal(a.endTime),
      status: a.status,
      notes: a.notes,
    }
    this.showModal = true
  }

  private toLocal(iso: string) {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  save() {
    this.saving = true
    const body = {
      patientId: this.form.patientId,
      startTime: new Date(this.form.startTime!).toISOString(),
      endTime: new Date(this.form.endTime!).toISOString(),
      status: this.form.status || 'SCHEDULED',
      notes: this.form.notes || undefined,
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
