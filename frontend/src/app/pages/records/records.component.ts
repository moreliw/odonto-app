import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'

type Patient = { id: string; name: string; email?: string }
type PatientRecord = { id: string; patientId: string; content: any; createdAt: string }

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="page-header">
        <div class="page-header-left">
          <h1>Prontuário</h1>
          <p>Registros clínicos e arquivos dos pacientes</p>
        </div>
      </div>

      <!-- Patient Selector -->
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div class="form-group" style="flex:1;min-width:220px;margin:0;">
            <label>Selecionar paciente</label>
            <div class="input-wrapper" style="margin-top:6px;">
              <span class="input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </span>
              <select class="select" style="padding-left:36px;" [(ngModel)]="selectedPatientId" name="patient" (ngModelChange)="onPatientChange($event)">
                <option value="">Escolha um paciente para ver o prontuário</option>
                @for (p of patients; track p.id) {
                  <option [value]="p.id">{{ p.name }}{{ p.email ? ' · ' + p.email : '' }}</option>
                }
              </select>
            </div>
          </div>
          @if (selectedPatient) {
            <button class="btn btn-primary" (click)="showNewRecord=true" style="margin-top:20px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Novo registro
            </button>
          }
        </div>
      </div>

      @if (!selectedPatient) {
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h3>Selecione um paciente</h3>
            <p>Escolha um paciente acima para visualizar e gerenciar seus prontuários</p>
          </div>
        </div>
      } @else {
        <!-- Patient Info Card -->
        <div class="card" style="margin-bottom:16px;padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="patient-avatar" style="width:44px;height:44px;font-size:16px;">{{ selectedPatient.name[0].toUpperCase() }}</div>
            <div>
              <div style="font-weight:600;font-size:15px;color:var(--text);">{{ selectedPatient.name }}</div>
              @if (selectedPatient.email) { <div class="text-sm muted">{{ selectedPatient.email }}</div> }
            </div>
          </div>
        </div>

        <!-- Records List -->
        <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
            <h2 style="margin:0;">Registros clínicos</h2>
            <span class="badge badge-neutral">{{ records.length }} registro{{ records.length !== 1 ? 's' : '' }}</span>
          </div>

          @if (loadingRecords) {
            <div class="table-empty"><span class="spinner spinner-dark"></span></div>
          } @else if (records.length === 0) {
            <div class="empty-state">
              <h3>Sem registros</h3>
              <p>Clique em "Novo registro" para adicionar uma anotação</p>
            </div>
          } @else {
            <div>
              @for (r of records; track r.id) {
                <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <span class="text-xs muted">{{ r.createdAt | date:'dd/MM/yyyy · HH:mm' }}</span>
                  </div>
                  <p style="font-size:14px;color:var(--text);white-space:pre-wrap;line-height:1.6;">{{ r.content?.text || (r.content | json) }}</p>
                </div>
              }
            </div>
          }
        </div>

        <!-- File Upload -->
        <div class="card">
          <h2>Arquivos e imagens</h2>
          <div class="upload" (click)="fileInput.click()">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:10px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p style="font-weight:500;font-size:14px;margin-bottom:4px;">Clique para fazer upload</p>
            <p class="text-sm muted">PDF, imagens (JPG, PNG). Até 20 MB</p>
            <input #fileInput type="file" style="display:none;" (change)="onFile($event)" accept=".pdf,.jpg,.jpeg,.png" />
          </div>
          @if (uploadProgress) {
            <div style="margin-top:12px;display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;">
              <span class="spinner spinner-dark"></span> {{ uploadProgress }}
            </div>
          }
        </div>
      }
    </div>

    <!-- New Record Modal -->
    @if (showNewRecord) {
      <div class="modal-backdrop" (click)="showNewRecord=false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Novo registro</h3>
              <p>Anotação clínica para {{ selectedPatient?.name }}</p>
            </div>
            <button class="btn btn-icon" (click)="showNewRecord=false" aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form class="form" (ngSubmit)="saveRecord()">
            <div class="form-group">
              <label>Anotação clínica *</label>
              <textarea
                class="textarea"
                [(ngModel)]="recordContent"
                name="content"
                placeholder="Descreva o diagnóstico, procedimentos realizados, observações..."
                rows="6"
                required
              ></textarea>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" type="button" (click)="showNewRecord=false">Cancelar</button>
              <button class="btn btn-primary" [disabled]="saving" type="submit">
                @if (saving) { <span class="spinner"></span> } Salvar registro
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class RecordsComponent implements OnInit {
  patients: Patient[] = []
  records: PatientRecord[] = []
  selectedPatientId = ''
  selectedPatient: Patient | null = null
  recordContent = ''
  loadingRecords = false
  saving = false
  showNewRecord = false
  uploadProgress = ''

  constructor(private http: HttpClient, private toast: ToastService) {}

  ngOnInit() {
    this.http.get<Patient[]>('/api/patients').subscribe({ next: (res: Patient[]) => this.patients = res })
  }

  onPatientChange(id: string) {
    this.selectedPatient = this.patients.find(p => p.id === id) || null
    this.records = []
    if (id) this.loadRecords(id)
  }

  loadRecords(patientId: string) {
    this.loadingRecords = true
    this.http.get<Record[]>(`/api/records/${patientId}`).subscribe({
      next: (res: PatientRecord[]) => { this.records = res; this.loadingRecords = false },
      error: () => { this.loadingRecords = false; this.toast.error('Falha ao carregar prontuários') }
    })
  }

  saveRecord() {
    if (!this.recordContent.trim() || !this.selectedPatientId) return
    this.saving = true
    this.http.post('/api/records', { patientId: this.selectedPatientId, content: { text: this.recordContent } }).subscribe({
      next: () => {
        this.saving = false
        this.showNewRecord = false
        this.recordContent = ''
        this.toast.success('Registro salvo com sucesso')
        this.loadRecords(this.selectedPatientId)
      },
      error: (err: any) => { this.saving = false; this.toast.error('Erro ao salvar registro', err.error?.message) }
    })
  }

  async onFile(event: any) {
    const file: File = event.target.files?.[0]
    if (!file) return
    this.uploadProgress = 'Enviando arquivo...'
    try {
      const presign = await this.http.post<{ url: string; key: string }>('/api/files/presign', { contentType: file.type }).toPromise()
      if (!presign) throw new Error('Presign failed')
      await fetch(presign.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      await this.http.post('/api/files/finalize', {
        key: presign.key, url: presign.url.split('?')[0],
        contentType: file.type, size: file.size,
        patientId: this.selectedPatientId || undefined
      }).toPromise()
      this.uploadProgress = ''
      this.toast.success('Upload concluído', file.name)
    } catch {
      this.uploadProgress = ''
      this.toast.error('Falha no upload', 'Verifique o arquivo e tente novamente')
    }
    event.target.value = ''
  }
}
