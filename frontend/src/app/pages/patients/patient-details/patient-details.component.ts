import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import { AuthService } from '../../../services/auth.service'
import { ToastService } from '../../../services/toast.service'
import { PatientDetailsService } from './patient-details.service'
import { PatientAppointment, PatientFile, PatientInvoice, PatientProfile, PatientRecord, PatientTab, PatientWorkspace } from './patient-details.models'
import { PatientHeaderComponent } from './patient-header.component'
import { PatientDentalChartComponent } from './patient-dental-chart.component'

@Component({
  selector: 'app-patient-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PatientHeaderComponent, PatientDentalChartComponent],
  templateUrl: './patient-details.component.html',
  styleUrl: './patient-details.component.css'
})
export class PatientDetailsComponent implements OnInit {
  workspace: PatientWorkspace | null = null
  loading = true
  saving = false
  error = ''
  activeTab: PatientTab = 'overview'
  editingPersonal = false
  showTreatmentModal = false
  showRecordModal = false
  uploadOpen = false
  isAdmin = false
  isDentist = false
  patientForm: Partial<PatientProfile> = {}
  treatmentForm = this.emptyTreatment()
  clinicalForm = this.emptyClinical()
  selectedUpload: File | null = null
  uploadCategory = 'OTHER'
  uploadNotes = ''
  uploading = false

  readonly baseTabs: Array<{ id: PatientTab; label: string }> = [
    { id:'overview', label:'Visão geral' }, { id:'personal', label:'Dados pessoais' }, { id:'odontogram', label:'Odontograma' },
    { id:'treatments', label:'Tratamentos' }, { id:'records', label:'Prontuário' }, { id:'files', label:'Arquivos' },
    { id:'financial', label:'Financeiro' }, { id:'history', label:'Histórico' }
  ]
  readonly fileCategories = [
    ['RADIOGRAPH','Radiografia'],['EXAM','Exame'],['PHOTO','Foto'],['DOCUMENT','Documento'],['PRESCRIPTION','Receita'],['CONSENT','Termo'],['OTHER','Outro']
  ].map(([id,label]) => ({id,label}))

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: PatientDetailsService,
    private readonly http: HttpClient,
    private readonly toast: ToastService,
    auth: AuthService
  ) { this.isAdmin = auth.isAdmin(); this.isDentist = auth.isDentist() }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id')
      if (id) this.load(id)
    })
  }

  get patient() { return this.workspace?.patient || null }
  get tabs() { return this.baseTabs.filter(tab => tab.id !== 'financial' || this.isAdmin) }
  get now() { return Date.now() }
  get upcomingAppointments() { return (this.workspace?.appointments || []).filter(item => item.status === 'SCHEDULED' && +new Date(item.startTime) >= this.now).sort((a,b) => +new Date(a.startTime) - +new Date(b.startTime)) }
  get previousAppointments() { return (this.workspace?.appointments || []).filter(item => +new Date(item.startTime) < this.now || item.status === 'COMPLETED').sort((a,b) => +new Date(b.startTime) - +new Date(a.startTime)) }
  get treatmentRecords() { return (this.workspace?.records || []).filter(item => ['TREATMENT','TREATMENT_PLAN'].includes(item.content?.type)) }
  get openTreatments() { return this.treatmentRecords.filter(item => !['COMPLETED','CANCELLED'].includes(item.content?.status)).length }
  get clinicalRecords() { return (this.workspace?.records || []).filter(item => !['ANAMNESIS','ODONTOGRAM','TREATMENT','TREATMENT_PLAN','DOCUMENT'].includes(item.content?.type)) }
  get anamnesis() { return (this.workspace?.records || []).find(item => item.content?.type === 'ANAMNESIS')?.content || null }
  get dentalFindings(): any[] {
    const content = (this.workspace?.records || []).find(item => item.content?.type === 'ODONTOGRAM')?.content
    if (Array.isArray(content?.findings)) return content.findings
    return (content?.entries || []).map((entry: any) => ({ teeth:[entry.tooth], status:entry.status }))
  }
  get dentalSummary() {
    const map = [['CARIES','Cáries'],['RESTORATION','Restaurações'],['MISSING','Ausentes'],['IMPLANT','Implantes'],['IN_PROGRESS','Em andamento']]
    return map.map(([id,label]) => ({ id, label, count:new Set(this.dentalFindings.filter(item => item.status === id).flatMap(item => item.teeth || [])).size }))
  }
  get financialSummary() {
    const invoices = this.workspace?.invoices || []
    const total = invoices.filter(i => i.status !== 'CANCELLED').reduce((sum,i) => sum + Number(i.amount) - Number(i.discount || 0), 0)
    const paid = invoices.flatMap(i => i.payments || []).reduce((sum,p) => sum + Number(p.amount), 0)
    const overdue = invoices.filter(i => !['PAID','CANCELLED'].includes(i.status) && +new Date(i.dueDate) < this.now).reduce((sum,i) => sum + Math.max(0, Number(i.amount) - Number(i.discount || 0) - (i.payments || []).reduce((value,p) => value + Number(p.amount),0)),0)
    return { total, paid, pending:Math.max(0,total-paid), overdue }
  }
  get clinicalAlerts() {
    const patient = this.patient
    if (!patient) return []
    const alerts = [
      ['Alergias', patient.allergies || this.anamnesis?.allergies],
      ['Medicamentos em uso', patient.medications || this.anamnesis?.medications],
      ['Condições preexistentes', patient.preexistingConditions],
      ['Observações médicas', patient.medicalNotes],
      ['Observações gerais', patient.notes]
    ]
    return alerts.filter((item): item is string[] => Boolean(item[1])).map(([label,value]) => ({label,value}))
  }
  get historyItems() {
    if (!this.workspace) return []
    const appointmentEvents = this.workspace.appointments.map(item => ({ id:`appointment-${item.id}`, date:item.startTime, type:'APPOINTMENT', title:this.appointmentHistoryTitle(item), detail:`${this.professionalName(item)}${item.notes ? ' · ' + item.notes : ''}` }))
    const recordEvents = this.workspace.records.map(item => ({ id:`record-${item.id}`, date:item.content?.clinicalDate || item.createdAt, type:item.content?.type || 'RECORD', title:this.recordTitle(item), detail:item.createdByName || 'Sistema' }))
    const fileEvents = this.workspace.files.map(item => ({ id:`file-${item.id}`, date:item.createdAt, type:'FILE', title:`Arquivo adicionado: ${item.originalName || 'Documento'}`, detail:item.uploadedByName || 'Sistema' }))
    const invoiceEvents = this.isAdmin ? this.workspace.invoices.map(item => ({ id:`invoice-${item.id}`, date:item.issuedAt, type:'FINANCIAL', title:`Cobrança ${this.invoiceStatusLabel(item.status).toLowerCase()}`, detail:item.description })) : []
    const created = [{ id:`patient-${this.workspace.patient.id}`, date:this.workspace.patient.createdAt, type:'PATIENT', title:'Paciente cadastrado', detail:this.workspace.patient.createdByName || 'Sistema' }]
    return [...appointmentEvents,...recordEvents,...fileEvents,...invoiceEvents,...created].sort((a,b) => +new Date(b.date) - +new Date(a.date))
  }

  load(id = this.patient?.id) {
    if (!id) return
    this.loading = true; this.error = ''
    this.api.workspace(id).subscribe({
      next: data => { this.workspace = data; this.patientForm = this.editPayload(data.patient); this.loading = false },
      error: error => { this.loading = false; this.error = error?.status === 404 ? 'Paciente não encontrado ou indisponível para seu perfil.' : 'Não foi possível carregar a ficha do paciente.' }
    })
  }
  selectTab(tab: PatientTab) { this.activeTab = tab }
  beginEdit() { if (!this.patient) return; this.patientForm = this.editPayload(this.patient); this.editingPersonal = true; this.activeTab = 'personal' }
  cancelEdit() { this.editingPersonal = false; if (this.patient) this.patientForm = this.editPayload(this.patient) }
  async savePatient() {
    if (!this.patient?.id || !this.patientForm.name?.trim() || this.saving) return
    this.saving = true
    try {
      const payload: any = Object.fromEntries(Object.entries(this.patientForm).map(([key,value]) => [key, typeof value === 'string' ? value.trim() || null : value]))
      payload.name = this.patientForm.name.trim()
      payload.birthDate = this.patientForm.birthDate ? new Date(this.patientForm.birthDate).toISOString() : null
      const updated = await firstValueFrom(this.api.updatePatient(this.patient.id, payload))
      if (this.workspace) this.workspace = { ...this.workspace, patient:updated }
      this.editingPersonal = false; this.toast.success('Dados do paciente atualizados')
    } catch (error: any) { this.toast.error('Não foi possível atualizar o paciente', error?.error?.message) }
    finally { this.saving = false }
  }
  openTreatment() { this.treatmentForm = this.emptyTreatment(); this.showTreatmentModal = true }
  async saveTreatment() {
    if (!this.patient || !this.treatmentForm.procedure.trim() || this.saving) return
    this.saving = true
    try {
      const professional = this.workspace?.professionals.find(item => item.id === this.treatmentForm.professionalId)
      const created = await firstValueFrom(this.api.createRecord(this.patient.id, { type:'TREATMENT', title:this.treatmentForm.procedure.trim(), procedure:this.treatmentForm.procedure.trim(), tooth:this.treatmentForm.tooth.trim(), professionalId:professional?.id, professionalName:professional?.name, clinicalDate:this.treatmentForm.date, value:Number(this.treatmentForm.value || 0), status:this.treatmentForm.status, notes:this.treatmentForm.notes.trim() }))
      this.prependRecord(created); this.showTreatmentModal = false; this.toast.success('Tratamento adicionado')
    } catch (error: any) { this.toast.error('Não foi possível salvar o tratamento', error?.error?.message) }
    finally { this.saving = false }
  }
  openClinicalRecord() { this.clinicalForm = this.emptyClinical(); this.showRecordModal = true }
  async saveClinicalRecord() {
    if (!this.patient || !this.clinicalForm.description.trim() || this.saving) return
    this.saving = true
    try {
      const created = await firstValueFrom(this.api.createRecord(this.patient.id, { type:'EVOLUTION', title:this.clinicalForm.title.trim() || 'Evolução clínica', clinicalDate:new Date(this.clinicalForm.date).toISOString(), procedure:this.clinicalForm.procedure.trim(), teeth:this.clinicalForm.teeth.split(/[,;\s]+/).filter(Boolean), subjective:this.clinicalForm.description.trim(), notes:this.clinicalForm.notes.trim() }))
      this.prependRecord(created); this.showRecordModal = false; this.toast.success('Evolução clínica registrada')
    } catch (error: any) { this.toast.error('Não foi possível salvar a evolução', error?.error?.message) }
    finally { this.saving = false }
  }
  onDentalRecordSaved(record: PatientRecord) { this.prependRecord(record) }
  onFileSelected(event: Event) { this.selectedUpload = (event.target as HTMLInputElement).files?.[0] || null }
  onFileDrop(event: DragEvent) { event.preventDefault(); this.selectedUpload = event.dataTransfer?.files?.[0] || null }
  async uploadFile() {
    if (!this.patient || !this.selectedUpload || this.uploading) return
    if (this.selectedUpload.size > 20 * 1024 * 1024) { this.toast.error('O arquivo deve ter no máximo 20 MB'); return }
    this.uploading = true
    try {
      const file = this.selectedUpload
      const presign = await firstValueFrom(this.http.post<{url:string;key:string}>('/api/files/presign',{contentType:file.type || 'application/octet-stream'}))
      const response = await fetch(presign.url,{method:'PUT',headers:{'Content-Type':file.type || 'application/octet-stream'},body:file})
      if (!response.ok) throw new Error('Falha no envio')
      const created = await firstValueFrom(this.http.post<PatientFile>('/api/files/finalize',{key:presign.key,url:presign.url.split('?')[0],contentType:file.type || 'application/octet-stream',size:file.size,patientId:this.patient.id,originalName:file.name,category:this.uploadCategory,notes:this.uploadNotes}))
      if (this.workspace) this.workspace = { ...this.workspace, files:[created,...this.workspace.files] }
      this.selectedUpload = null; this.uploadNotes=''; this.uploadOpen=false; this.toast.success('Arquivo adicionado à ficha')
    } catch (error: any) { this.toast.error('Não foi possível enviar o arquivo', error?.error?.message || error?.message) }
    finally { this.uploading = false }
  }
  downloadFile(file: PatientFile) { window.open(`/api/files/${file.id}/content`,'_blank','noopener') }
  async deleteFile(file: PatientFile) {
    if (!confirm(`Excluir o arquivo "${file.originalName || 'Documento'}"?`)) return
    try { await firstValueFrom(this.http.delete(`/api/files/${file.id}`)); if (this.workspace) this.workspace = { ...this.workspace, files:this.workspace.files.filter(item => item.id !== file.id) }; this.toast.success('Arquivo excluído') }
    catch (error: any) { this.toast.error('Não foi possível excluir o arquivo', error?.error?.message) }
  }
  professionalName(appointment: PatientAppointment) { return appointment.dentist?.name || appointment.dentistName || 'Sem profissional' }
  appointmentStatusLabel(status: string) { return ({SCHEDULED:'Agendada',COMPLETED:'Concluída',CANCELLED:'Cancelada'} as Record<string,string>)[status] || status }
  confirmationLabel(status?: string) { return ({PENDING:'Aguardando confirmação',CONFIRMED:'Confirmada',DECLINED:'Recusada'} as Record<string,string>)[status || ''] || 'Sem confirmação' }
  treatmentStatusLabel(status?: string) { return ({PROPOSED:'Planejado',PLANNED:'Planejado',APPROVED:'Aprovado',IN_PROGRESS:'Em andamento',COMPLETED:'Concluído',CANCELLED:'Cancelado',PAUSED:'Pausado'} as Record<string,string>)[status || ''] || 'Planejado' }
  invoiceStatusLabel(status: string) { return ({PENDING:'Pendente',PARTIAL:'Parcial',PAID:'Paga',CANCELLED:'Cancelada'} as Record<string,string>)[status] || status }
  fileCategoryLabel(id?: string | null) { return this.fileCategories.find(item => item.id === id)?.label || 'Arquivo' }
  recordTitle(record: PatientRecord) { return record.content?.title || record.content?.procedure || ({ODONTOGRAM:'Odontograma atualizado',ANAMNESIS:'Anamnese registrada',EVOLUTION:'Evolução clínica'} as Record<string,string>)[record.content?.type] || 'Registro clínico' }
  recordSummary(record: PatientRecord) { return record.content?.subjective || record.content?.assessment || record.content?.procedure || record.content?.notes || record.content?.text || 'Registro clínico sem descrição adicional.' }
  formatMoney(value: number) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value || 0) }
  invoicePaid(invoice: PatientInvoice) { return (invoice.payments || []).reduce((sum,payment) => sum + Number(payment.amount),0) }
  dentalBarWidth(count: number) { return count ? Math.min(100,count*12) : 3 }
  formatSize(size: number) { return size < 1024*1024 ? `${Math.max(1,Math.round(size/1024))} KB` : `${(size/1024/1024).toFixed(1)} MB` }
  private appointmentHistoryTitle(item: PatientAppointment) { return item.status === 'COMPLETED' ? 'Consulta realizada' : item.status === 'CANCELLED' ? 'Consulta cancelada' : 'Consulta agendada' }
  private prependRecord(record: PatientRecord) { if (this.workspace) this.workspace = { ...this.workspace, records:[record,...this.workspace.records] } }
  private editPayload(patient: PatientProfile): Partial<PatientProfile> { const value:any={...patient,birthDate:patient.birthDate?.split('T')[0] || ''}; delete value.createdAt; delete value.updatedAt; delete value.createdByName; delete value.updatedByName; return value }
  private emptyTreatment() { return { procedure:'', tooth:'', professionalId:'', date:new Date().toISOString().slice(0,10), value:'', status:'PLANNED', notes:'' } }
  private emptyClinical() { const date=new Date(); date.setMinutes(date.getMinutes()-date.getTimezoneOffset()); return { title:'', description:'', procedure:'', teeth:'', date:date.toISOString().slice(0,16), notes:'' } }
}
