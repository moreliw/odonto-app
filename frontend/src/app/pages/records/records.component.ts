import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ActivatedRoute } from '@angular/router'
import { firstValueFrom } from 'rxjs'
import { ToastService } from '../../services/toast.service'
import { SearchableSelectComponent } from '../../components/searchable-select/searchable-select.component'
import { PaginationComponent } from '../../components/pagination/pagination.component'
import { paginate } from '../../utils/pagination'
import { AuthService } from '../../services/auth.service'

type Patient = {
  id: string
  name: string
  email?: string
  phone?: string
  birthDate?: string
  document?: string
}

type PatientRecord = {
  id: string
  patientId: string
  content: any
  createdByName?: string | null
  updatedByName?: string | null
  createdAt: string
  updatedAt?: string
}

type RecordTab = 'summary' | 'evolutions' | 'anamnesis' | 'odontogram' | 'plans' | 'documents'
type ToothEntry = { tooth: string; status: string; surfaces: string[]; note: string }

const EMPTY_ANAMNESIS = {
  chiefComplaint: '', currentHistory: '', medicalHistory: '', dentalHistory: '', allergies: '', medications: '',
  surgeries: '', observations: '', hasAllergies: false, usesMedications: false, hasDiabetes: false,
  hasHypertension: false, hasHeartCondition: false, hasBleedingRisk: false, hasInfectiousDisease: false,
  isPregnant: false, smoker: false, anesthesiaReaction: false, informationConfirmed: false
}

@Component({
  selector: 'app-records',
  imports: [CommonModule, FormsModule, SearchableSelectComponent, PaginationComponent],
  templateUrl: './records.component.html',
  styleUrl: './records.component.css'
})
export class RecordsComponent implements OnInit {
  patients: Patient[] = []
  records: PatientRecord[] = []
  selectedPatientId = ''
  selectedPatient: Patient | null = null
  activeTab: RecordTab = 'summary'
  loadingRecords = false
  saving = false
  isAdmin = false
  isDentist = false

  showEvolutionModal = false
  evolutionPage = 1
  planPage = 1
  documentPage = 1
  readonly evolutionPageSize = 8
  readonly planPageSize = 6
  readonly documentPageSize = 9
  appointmentId = ''

  evolutionForm = this.newEvolutionForm()
  anamnesisForm = { ...EMPTY_ANAMNESIS }
  planForm = this.newPlanForm()
  showPlanForm = false

  odontogramState: Record<string, ToothEntry> = {}
  selectedTooth = '11'
  dentition: 'PERMANENT' | 'DECIDUOUS' = 'PERMANENT'
  odontogramNotes = ''
  odontogramDirty = false

  documentTitle = ''
  documentCategory = 'RADIOGRAPH'
  documentNotes = ''
  selectedFile: File | null = null
  uploadProgress = ''
  draggingFile = false

  readonly upperPermanent = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28']
  readonly lowerPermanent = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']
  readonly upperDeciduous = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65']
  readonly lowerDeciduous = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75']
  readonly surfaces = ['M', 'D', 'V', 'L/P', 'O/I']
  readonly toothStatuses = [
    { id: 'HEALTHY', label: 'Hígido' },
    { id: 'CARIES', label: 'Cárie' },
    { id: 'RESTORATION', label: 'Restauração' },
    { id: 'CROWN', label: 'Coroa/prótese' },
    { id: 'ENDO', label: 'Endodontia' },
    { id: 'IMPLANT', label: 'Implante' },
    { id: 'MISSING', label: 'Ausente' },
    { id: 'EXTRACTION', label: 'Extração indicada' },
    { id: 'WATCH', label: 'Em observação' }
  ]
  readonly recordTypes = [
    { id: 'EVOLUTION', label: 'Evolução clínica' },
    { id: 'INTERCURRENCE', label: 'Intercorrência' },
    { id: 'EXAM', label: 'Exame/diagnóstico' },
    { id: 'PRESCRIPTION', label: 'Prescrição/orientação' },
    { id: 'REFERRAL', label: 'Encaminhamento' },
    { id: 'COMMUNICATION', label: 'Contato com o paciente' },
    { id: 'CONSENT', label: 'Consentimento registrado' }
  ]
  readonly documentCategories = [
    { id: 'RADIOGRAPH', label: 'Radiografia' },
    { id: 'INTRAORAL_PHOTO', label: 'Foto intraoral' },
    { id: 'EXAM', label: 'Exame/laudo' },
    { id: 'CONSENT', label: 'Termo de consentimento' },
    { id: 'PRESCRIPTION', label: 'Prescrição' },
    { id: 'REFERRAL', label: 'Encaminhamento' },
    { id: 'OTHER', label: 'Outro documento' }
  ]

  constructor(
    private readonly http: HttpClient,
    private readonly toast: ToastService,
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.isAdmin = this.auth.isAdmin()
    this.isDentist = this.auth.isDentist()
    this.appointmentId = this.route.snapshot.queryParamMap.get('appointmentId') || ''
    this.http.get<Patient[]>('/api/patients').subscribe({
      next: patients => {
        this.patients = patients
        const patientId = this.route.snapshot.queryParamMap.get('patientId') || ''
        if (patientId && patients.some(patient => patient.id === patientId)) {
          this.selectedPatientId = patientId
          this.onPatientChange(patientId)
          if (this.route.snapshot.queryParamMap.get('new') === 'evolution') this.openEvolution()
        }
      },
      error: () => this.toast.error('Falha ao carregar pacientes')
    })
  }

  get patientItems() {
    return this.patients.map(patient => ({ id: patient.id, label: patient.name, sublabel: patient.email }))
  }

  get timelineRecords() {
    return this.records.filter(record => !['ANAMNESIS', 'ODONTOGRAM', 'TREATMENT_PLAN', 'DOCUMENT'].includes(this.recordType(record)))
  }

  get planRecords() {
    return this.records.filter(record => this.recordType(record) === 'TREATMENT_PLAN')
  }

  get documentRecords() {
    return this.records.filter(record => this.recordType(record) === 'DOCUMENT')
  }

  get latestAnamnesis() {
    return this.records.find(record => this.recordType(record) === 'ANAMNESIS') || null
  }

  get latestOdontogram() {
    return this.records.find(record => this.recordType(record) === 'ODONTOGRAM') || null
  }

  get pagedEvolutionRecords() { return paginate(this.timelineRecords, this.evolutionPage, this.evolutionPageSize) }
  get pagedPlanRecords() { return paginate(this.planRecords, this.planPage, this.planPageSize) }
  get pagedDocumentRecords() { return paginate(this.documentRecords, this.documentPage, this.documentPageSize) }

  get selectedToothEntry(): ToothEntry {
    return this.odontogramState[this.selectedTooth] || { tooth: this.selectedTooth, status: 'HEALTHY', surfaces: [], note: '' }
  }

  get healthAlerts() {
    const source = this.latestAnamnesis?.content
    if (!source) return []
    const alerts: { label: string; detail?: string; tone: string }[] = []
    if (source.hasAllergies) alerts.push({ label: 'Alergias', detail: source.allergies, tone: 'danger' })
    if (source.usesMedications) alerts.push({ label: 'Uso de medicamentos', detail: source.medications, tone: 'warning' })
    if (source.hasBleedingRisk) alerts.push({ label: 'Risco de sangramento', tone: 'danger' })
    if (source.anesthesiaReaction) alerts.push({ label: 'Reação a anestésico', tone: 'danger' })
    if (source.hasHeartCondition) alerts.push({ label: 'Condição cardíaca', tone: 'warning' })
    if (source.hasDiabetes) alerts.push({ label: 'Diabetes', tone: 'warning' })
    if (source.hasHypertension) alerts.push({ label: 'Hipertensão', tone: 'warning' })
    if (source.hasInfectiousDisease) alerts.push({ label: 'Doença infectocontagiosa', tone: 'warning' })
    if (source.isPregnant) alerts.push({ label: 'Gestação', tone: 'blue' })
    return alerts
  }

  get patientAge() {
    if (!this.selectedPatient?.birthDate) return null
    const birth = new Date(this.selectedPatient.birthDate)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--
    return age
  }

  onPatientChange(id: string) {
    this.selectedPatient = this.patients.find(patient => patient.id === id) || null
    this.records = []
    this.activeTab = 'summary'
    this.evolutionPage = this.planPage = this.documentPage = 1
    this.odontogramState = {}
    this.odontogramDirty = false
    if (id) this.loadRecords(id)
  }

  loadRecords(patientId: string) {
    this.loadingRecords = true
    this.http.get<PatientRecord[]>(`/api/records/patient/${patientId}`).subscribe({
      next: records => {
        this.records = records
        this.loadingRecords = false
        this.restoreLatestStructuredRecords()
      },
      error: () => {
        this.loadingRecords = false
        this.toast.error('Falha ao carregar prontuário')
      }
    })
  }

  selectTab(tab: RecordTab) {
    this.activeTab = tab
  }

  openEvolution(type = 'EVOLUTION') {
    this.evolutionForm = this.newEvolutionForm()
    this.evolutionForm.type = type
    this.showEvolutionModal = true
  }

  async saveEvolution() {
    const form = this.evolutionForm
    if (!this.selectedPatientId || ![form.subjective, form.objective, form.assessment, form.plan, form.procedure].some(value => value.trim())) {
      this.toast.error('Informe ao menos um dado clínico antes de salvar')
      return
    }
    await this.createRecord({
      ...form,
      type: form.type,
      title: form.title.trim() || this.labelForType(form.type),
      appointmentId: this.appointmentId || undefined,
      teeth: [...form.teeth],
      surfaces: [...form.surfaces]
    }, 'Registro clínico salvo')
    this.showEvolutionModal = false
    this.activeTab = 'evolutions'
  }

  async saveAnamnesis() {
    if (!this.selectedPatientId) return
    if (!this.anamnesisForm.chiefComplaint.trim()) {
      this.toast.error('Informe a queixa principal')
      return
    }
    await this.createRecord({ type: 'ANAMNESIS', title: 'Anamnese', ...this.anamnesisForm }, 'Nova versão da anamnese salva')
    this.activeTab = 'anamnesis'
  }

  async savePlan() {
    if (!this.planForm.title.trim() || !this.planForm.procedures.trim()) {
      this.toast.error('Informe o título e os procedimentos do plano')
      return
    }
    await this.createRecord({ type: 'TREATMENT_PLAN', ...this.planForm, teeth: [...this.planForm.teeth] }, 'Plano de tratamento registrado')
    this.planForm = this.newPlanForm()
    this.showPlanForm = false
    this.activeTab = 'plans'
  }

  async saveOdontogram() {
    const entries = Object.values(this.odontogramState).filter(entry => entry.status !== 'HEALTHY' || entry.note || entry.surfaces.length)
    if (!entries.length) {
      this.toast.error('Marque ao menos uma condição no odontograma')
      return
    }
    await this.createRecord({
      type: 'ODONTOGRAM', title: 'Odontograma clínico', dentition: this.dentition,
      entries, notes: this.odontogramNotes
    }, 'Odontograma salvo no histórico')
    this.odontogramDirty = false
    this.activeTab = 'odontogram'
  }

  selectTooth(tooth: string) {
    this.selectedTooth = tooth
    if (!this.odontogramState[tooth]) this.odontogramState[tooth] = { tooth, status: 'HEALTHY', surfaces: [], note: '' }
  }

  updateToothStatus(status: string) {
    this.ensureSelectedTooth().status = status
    this.odontogramDirty = true
  }

  updateToothNote(note: string) {
    this.ensureSelectedTooth().note = note
    this.odontogramDirty = true
  }

  toggleOdontogramSurface(surface: string) {
    const entry = this.ensureSelectedTooth()
    entry.surfaces = entry.surfaces.includes(surface)
      ? entry.surfaces.filter(item => item !== surface)
      : [...entry.surfaces, surface]
    this.odontogramDirty = true
  }

  toggleEvolutionTooth(tooth: string) {
    this.evolutionForm.teeth = this.evolutionForm.teeth.includes(tooth)
      ? this.evolutionForm.teeth.filter(item => item !== tooth)
      : [...this.evolutionForm.teeth, tooth]
  }

  toggleEvolutionSurface(surface: string) {
    this.evolutionForm.surfaces = this.evolutionForm.surfaces.includes(surface)
      ? this.evolutionForm.surfaces.filter(item => item !== surface)
      : [...this.evolutionForm.surfaces, surface]
  }

  toothClass(tooth: string) {
    const status = this.odontogramState[tooth]?.status || 'HEALTHY'
    return `tooth-${status.toLowerCase()}`
  }

  onFileInput(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files?.[0]) this.prepareFile(input.files[0])
    input.value = ''
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault()
    this.draggingFile = false
    if (event.dataTransfer?.files?.[0]) this.prepareFile(event.dataTransfer.files[0])
  }

  prepareFile(file: File) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      this.toast.error('Formato não permitido', 'Use PDF, JPG, PNG ou WEBP')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      this.toast.error('Arquivo muito grande', 'O limite é 20 MB')
      return
    }
    this.selectedFile = file
    if (!this.documentTitle) this.documentTitle = file.name.replace(/\.[^.]+$/, '')
  }

  async uploadDocument() {
    if (!this.selectedFile || !this.selectedPatientId || !this.documentTitle.trim()) {
      this.toast.error('Selecione um arquivo e informe o título')
      return
    }
    this.saving = true
    this.uploadProgress = 'Preparando envio seguro...'
    try {
      const file = this.selectedFile
      const presign = await firstValueFrom(this.http.post<{ url: string; key: string }>('/api/files/presign', { contentType: file.type }))
      this.uploadProgress = 'Enviando arquivo...'
      const upload = await fetch(presign.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!upload.ok) throw new Error('Upload failed')
      const stored = await firstValueFrom(this.http.post<any>('/api/files/finalize', {
        key: presign.key, url: presign.url.split('?')[0], contentType: file.type,
        size: file.size, patientId: this.selectedPatientId
      }))
      this.uploadProgress = 'Organizando no prontuário...'
      await firstValueFrom(this.http.post('/api/records', {
        patientId: this.selectedPatientId,
        content: {
          type: 'DOCUMENT', title: this.documentTitle.trim(), category: this.documentCategory,
          notes: this.documentNotes.trim(), file: { id: stored.id, name: file.name, contentType: file.type, size: file.size }
        }
      }))
      this.toast.success('Documento anexado ao prontuário')
      this.selectedFile = null
      this.documentTitle = this.documentNotes = ''
      this.documentCategory = 'RADIOGRAPH'
      this.uploadProgress = ''
      this.documentPage = 1
      this.loadRecords(this.selectedPatientId)
    } catch (error: any) {
      this.uploadProgress = ''
      this.toast.error('Falha no upload', error?.error?.message || 'Verifique o arquivo e tente novamente')
    } finally {
      this.saving = false
    }
  }

  downloadDocument(record: PatientRecord) {
    const file = record.content?.file
    if (!file?.id) return
    const preview = window.open('', '_blank')
    if (preview) {
      preview.opener = null
      preview.document.title = 'Carregando documento...'
      preview.document.body.textContent = 'Carregando documento com segurança...'
    }
    this.http.get(`/api/files/${file.id}/content`, { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob)
        if (preview) {
          preview.location.href = url
        } else {
          const link = document.createElement('a')
          link.href = url
          link.download = file.name || record.content?.title || 'documento'
          link.click()
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      },
      error: () => {
        preview?.close()
        this.toast.error('Não foi possível abrir o documento')
      }
    })
  }

  recordType(record: PatientRecord) { return record.content?.type || 'LEGACY' }

  labelForType(type: string) {
    const labels: Record<string, string> = {
      EVOLUTION: 'Evolução clínica', INTERCURRENCE: 'Intercorrência', EXAM: 'Exame/diagnóstico',
      PRESCRIPTION: 'Prescrição/orientação', REFERRAL: 'Encaminhamento', COMMUNICATION: 'Contato com o paciente',
      CONSENT: 'Consentimento registrado', LEGACY: 'Anotação clínica', ANAMNESIS: 'Anamnese',
      ODONTOGRAM: 'Odontograma', TREATMENT_PLAN: 'Plano de tratamento', DOCUMENT: 'Documento'
    }
    return labels[type] || 'Registro clínico'
  }

  documentCategoryLabel(category: string) {
    return this.documentCategories.find(item => item.id === category)?.label || 'Documento'
  }

  planStatusLabel(status: string) {
    return ({ PROPOSED: 'Proposto', APPROVED: 'Aceito', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluído', PAUSED: 'Pausado' } as Record<string, string>)[status] || status
  }

  toothStatusLabel(status: string) {
    return this.toothStatuses.find(item => item.id === status)?.label || status
  }

  formatBytes(size = 0) {
    if (!size) return '—'
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }

  summaryText(record: PatientRecord) {
    const content = record.content || {}
    return content.text || content.assessment || content.procedure || content.subjective || content.plan || 'Registro clínico sem resumo.'
  }

  private async createRecord(content: Record<string, unknown>, successMessage: string) {
    if (!this.selectedPatientId || this.saving) return
    this.saving = true
    try {
      await firstValueFrom(this.http.post('/api/records', { patientId: this.selectedPatientId, content }))
      this.toast.success(successMessage)
      this.loadRecords(this.selectedPatientId)
    } catch (error: any) {
      this.toast.error('Erro ao salvar registro', error?.error?.message)
      throw error
    } finally {
      this.saving = false
    }
  }

  private restoreLatestStructuredRecords() {
    const latestAnamnesis = this.latestAnamnesis?.content
    this.anamnesisForm = latestAnamnesis ? { ...EMPTY_ANAMNESIS, ...latestAnamnesis } : { ...EMPTY_ANAMNESIS }

    if (!this.odontogramDirty) {
      const entries: ToothEntry[] = this.latestOdontogram?.content?.entries || []
      this.odontogramState = Object.fromEntries(entries.map(entry => [entry.tooth, { ...entry, surfaces: [...(entry.surfaces || [])] }]))
      this.odontogramNotes = this.latestOdontogram?.content?.notes || ''
    }
  }

  private ensureSelectedTooth() {
    if (!this.odontogramState[this.selectedTooth]) {
      this.odontogramState[this.selectedTooth] = { tooth: this.selectedTooth, status: 'HEALTHY', surfaces: [], note: '' }
    }
    return this.odontogramState[this.selectedTooth]
  }

  private newEvolutionForm() {
    return {
      type: 'EVOLUTION', title: '', clinicalDate: this.localDateTime(), subjective: '', objective: '', assessment: '',
      plan: '', procedure: '', technique: '', materials: '', anesthetic: '', prescription: '', guidance: '',
      intercurrences: '', nextVisit: '', patientCommunication: '', teeth: [] as string[], surfaces: [] as string[]
    }
  }

  private newPlanForm() {
    return {
      title: '', status: 'PROPOSED', diagnosis: '', objectives: '', alternatives: '', procedures: '',
      risksBenefits: '', estimate: '', patientDecision: '', notes: '', teeth: [] as string[]
    }
  }

  private localDateTime() {
    const date = new Date()
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    return date.toISOString().slice(0, 16)
  }
}
