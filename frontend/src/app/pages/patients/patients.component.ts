import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'

type Patient = { id: string; name: string; email?: string; phone?: string; birthDate?: string; document?: string; createdAt?: string }

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <!-- Page Header -->
      <div class="page-header">
        <div class="page-header-left">
          <h1>Pacientes</h1>
          <p>Gerencie o cadastro de todos os pacientes da clínica</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" (click)="openCreate()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo paciente
          </button>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="card" style="padding:16px 20px;margin-bottom:16px;">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <div class="input-wrapper" style="flex:1;min-width:200px;">
            <span class="input-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input class="input" [(ngModel)]="search" name="search" placeholder="Buscar por nome, e-mail ou documento..." style="padding-left:36px;" />
          </div>
          <span class="text-sm muted" style="white-space:nowrap;">
            {{ filtered.length }} paciente{{ filtered.length !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <!-- Table -->
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Contato</th>
                <th>Documento</th>
                <th>Nascimento</th>
                <th>Cadastro</th>
                <th style="width:80px;"></th>
              </tr>
            </thead>
            <tbody>
              @if (loading) {
                <tr><td colspan="6" class="table-empty">
                  <span class="spinner spinner-dark"></span>
                </td></tr>
              } @else if (filtered.length === 0) {
                <tr><td colspan="6">
                  <div class="empty-state">
                    <div class="empty-state-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    </div>
                    <h3>{{ search ? 'Nenhum paciente encontrado' : 'Sem pacientes cadastrados' }}</h3>
                    <p>{{ search ? 'Tente buscar com outros termos' : 'Clique em "Novo paciente" para começar' }}</p>
                  </div>
                </td></tr>
              } @else {
                @for (p of filtered; track p.id) {
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px;">
                        <div class="patient-avatar">{{ p.name[0].toUpperCase() }}</div>
                        <div>
                          <div style="font-weight:600;color:var(--text);">{{ p.name }}</div>
                          @if (p.email) { <div class="text-xs muted">{{ p.email }}</div> }
                        </div>
                      </div>
                    </td>
                    <td class="muted">{{ p.phone || '—' }}</td>
                    <td class="muted text-sm">{{ p.document || '—' }}</td>
                    <td class="muted text-sm">{{ p.birthDate ? (p.birthDate | date:'dd/MM/yyyy') : '—' }}</td>
                    <td class="muted text-xs">{{ p.createdAt | date:'dd/MM/yyyy' }}</td>
                    <td>
                      <div class="table-actions">
                        <button class="btn btn-sm btn-ghost" (click)="openEdit(p)" title="Editar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn btn-sm btn-ghost" style="color:var(--danger);" (click)="confirmDelete(p)" title="Excluir">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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
              <h3>{{ editingId ? 'Editar paciente' : 'Novo paciente' }}</h3>
              <p>{{ editingId ? 'Atualize os dados do paciente' : 'Preencha os dados para cadastrar' }}</p>
            </div>
            <button class="btn btn-icon" (click)="showModal=false" aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <form class="form" (ngSubmit)="save()">
            <div class="form-group">
              <label>Nome completo *</label>
              <input class="input" [(ngModel)]="form.name" name="name" placeholder="Nome do paciente" required />
            </div>

            <div class="grid cols-2">
              <div class="form-group">
                <label>E-mail</label>
                <input class="input" [(ngModel)]="form.email" name="email" type="email" placeholder="email@exemplo.com" />
              </div>
              <div class="form-group">
                <label>Telefone</label>
                <input class="input" [(ngModel)]="form.phone" name="phone" placeholder="(11) 99999-9999" />
              </div>
            </div>

            <div class="grid cols-2">
              <div class="form-group">
                <label>CPF / Documento</label>
                <input class="input" [(ngModel)]="form.document" name="document" placeholder="000.000.000-00" />
              </div>
              <div class="form-group">
                <label>Data de nascimento</label>
                <input class="input" [(ngModel)]="form.birthDate" name="birthDate" type="date" />
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn btn-ghost" type="button" (click)="showModal=false">Cancelar</button>
              <button class="btn btn-primary" [disabled]="saving" type="submit">
                @if (saving) { <span class="spinner"></span> }
                {{ editingId ? 'Salvar alterações' : 'Cadastrar paciente' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete Confirm Modal -->
    @if (deleteTarget) {
      <div class="modal-backdrop" (click)="deleteTarget=null">
        <div class="modal" style="max-width:400px;" (click)="$event.stopPropagation()">
          <div style="text-align:center;padding:8px 0 16px;">
            <div style="width:48px;height:48px;background:var(--danger-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--danger);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </div>
            <h3 style="font-size:17px;font-weight:700;margin-bottom:8px;">Excluir paciente?</h3>
            <p style="color:var(--muted);font-size:14px;">Esta ação não pode ser desfeita.<br/><strong style="color:var(--text);">{{ deleteTarget.name }}</strong> será removido permanentemente.</p>
          </div>
          <div style="display:flex;gap:10px;margin-top:16px;">
            <button class="btn btn-ghost" style="flex:1;" (click)="deleteTarget=null">Cancelar</button>
            <button class="btn btn-danger" style="flex:1;" [disabled]="saving" (click)="doDelete()">
              @if (saving) { <span class="spinner"></span> } Excluir
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class PatientsComponent implements OnInit {
  patients: Patient[] = []
  search = ''
  loading = false
  saving = false
  showModal = false
  editingId: string | null = null
  deleteTarget: Patient | null = null

  form: Partial<Patient> = {}

  constructor(private http: HttpClient, private toast: ToastService) {}

  ngOnInit() { this.load() }

  get filtered() {
    const q = this.search.toLowerCase().trim()
    if (!q) return this.patients
    return this.patients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.document || '').toLowerCase().includes(q)
    )
  }

  load() {
    this.loading = true
    this.http.get<Patient[]>('/api/patients').subscribe({
      next: (res: Patient[]) => { this.patients = res; this.loading = false },
      error: () => { this.loading = false; this.toast.error('Falha ao carregar pacientes') }
    })
  }

  openCreate() {
    this.editingId = null
    this.form = {}
    this.showModal = true
  }

  openEdit(p: Patient) {
    this.editingId = p.id
    this.form = { name: p.name, email: p.email, phone: p.phone, document: p.document, birthDate: p.birthDate ? p.birthDate.split('T')[0] : '' }
    this.showModal = true
  }

  save() {
    if (!this.form.name?.trim()) return
    this.saving = true
    const body = { ...this.form, birthDate: this.form.birthDate ? new Date(this.form.birthDate).toISOString() : undefined }
    const req = this.editingId
      ? this.http.put(`/api/patients/${this.editingId}`, body)
      : this.http.post('/api/patients', body)
    req.subscribe({
      next: () => {
        this.saving = false
        this.showModal = false
        this.toast.success(this.editingId ? 'Paciente atualizado' : 'Paciente cadastrado com sucesso')
        this.load()
      },
      error: (err: any) => {
        this.saving = false
        this.toast.error('Erro ao salvar', err.error?.message || 'Verifique os dados e tente novamente')
      }
    })
  }

  confirmDelete(p: Patient) { this.deleteTarget = p }

  doDelete() {
    if (!this.deleteTarget) return
    this.saving = true
    this.http.delete(`/api/patients/${this.deleteTarget.id}`).subscribe({
      next: () => {
        this.saving = false
        this.deleteTarget = null
        this.toast.success('Paciente excluído')
        this.load()
      },
      error: (err: any) => {
        this.saving = false
        this.toast.error('Erro ao excluir', err.error?.message)
      }
    })
  }

  closeOnBackdrop(ev: MouseEvent) {
    if ((ev.target as HTMLElement).classList.contains('modal-backdrop')) this.showModal = false
  }
}
