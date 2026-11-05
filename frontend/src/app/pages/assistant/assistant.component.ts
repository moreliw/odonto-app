import { Component, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { RouterLink } from '@angular/router'
import { firstValueFrom } from 'rxjs'
import { AuthService } from '../../services/auth.service'
import { PermissionKey } from '../../models/access-control.model'

type Tab = 'photo' | 'evolution' | 'estimates' | 'recalls' | 'weekly'
type Person = { id: string; name: string }
type Draft = { id: string; targetId?: string; content: { text?: string; transcript?: string; message?: string; warnings?: string[]; appointments?: any[] } }
type PhotoRow = { patientName: string; patientId: string; dentistId: string; startLocal: string; endLocal: string; procedure: string; warning: string; selected: boolean }
type Workspace = { ai: { provider: string; enabled: boolean }; permissions: string[]; patients: Person[]; professionals: Person[]; estimates: any[]; proposedPlans: any[]; recalls: any[]; today: string }

@Component({
  selector: 'app-assistant', imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './assistant.component.html', styleUrl: './assistant.component.css'
})
export class AssistantComponent implements OnInit, OnDestroy {
  workspace: Workspace | null = null
  tab: Tab = 'photo'
  busy = false
  loading = true
  error = ''
  notice = ''
  consent = false
  referenceDate = ''
  photoFile: File | null = null
  audioFile: File | null = null
  photoDraft: Draft | null = null
  evolutionDraft: Draft | null = null
  messageDraft: Draft | null = null
  photoRows: PhotoRow[] = []
  reviewedPhoto = false
  reviewedEvolution = false
  reviewedMessage = false
  patientId = ''
  dictation = ''
  evolutionText = ''
  messageText = ''
  whatsappUrl = ''
  recording = false
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private recordingTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  estimate = { patientId: '', title: '', amount: 0, proposedAt: '', notes: '' }
  recall = { patientId: '', intervalMonths: 6, dueDate: '' }
  weekly: any = null
  readonly tabs: { id: Tab; title: string; permission: PermissionKey }[] = [
    { id: 'photo', title: 'Foto para agenda', permission: 'APPOINTMENTS_MANAGE' },
    { id: 'evolution', title: 'Ditado clínico', permission: 'RECORDS_MANAGE' },
    { id: 'estimates', title: 'Orçamentos', permission: 'FINANCE_VIEW' },
    { id: 'recalls', title: 'Retornos', permission: 'PATIENTS_VIEW' },
    { id: 'weekly', title: 'Resumo semanal', permission: 'FINANCE_VIEW' }
  ]

  constructor(private readonly http: HttpClient, public readonly auth: AuthService) {}
  can(permission: PermissionKey) { return this.workspace?.permissions.includes(permission) ?? false }
  get visibleTabs() { return this.tabs.filter(t => this.can(t.permission) && !(t.id === 'photo' && this.auth.getUser()?.role === 'DENTIST')) }
  get canGenerate() { return Boolean(this.workspace?.ai.enabled && this.consent && !this.busy) }
  get pendingEstimates() { return this.workspace?.estimates.filter(e => e.status === 'PROPOSED') || [] }
  get selectedRows() { return this.photoRows.filter(row => row.selected) }
  get weeklySuggestions(): string[] { return this.weekly?.summary?.suggestions || [] }
  money(cents: number) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
  daysSince(date: string) { return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400_000)) }

  async ngOnInit() {
    await this.load()
    this.tab = this.visibleTabs[0]?.id || 'recalls'
  }

  ngOnDestroy() {
    this.destroyed = true
    this.stopRecording()
    this.stream?.getTracks().forEach(track => track.stop())
  }

  async load() {
    try {
      this.workspace = await firstValueFrom(this.http.get<Workspace>('/api/assistant/workspace'))
      this.referenceDate ||= this.workspace.today
      this.estimate.proposedAt ||= this.workspace.today
      if (this.can('FINANCE_VIEW') && this.can('DASHBOARD_VIEW')) {
        this.weekly = await firstValueFrom(this.http.get('/api/assistant/weekly'))
      }
    } catch (error: any) { this.error = error.error?.message || 'Não foi possível carregar o assistente. Tente atualizar a página.' }
    finally { this.loading = false }
  }

  private async run(action: () => Promise<void>) {
    if (this.busy) return
    this.busy = true
    this.error = ''
    this.notice = ''
    try { await action() }
    catch (error: any) { this.error = error.error?.message || 'Não foi possível concluir. Revise os dados e tente novamente.' }
    finally { this.busy = false }
  }

  chooseFile(event: Event, kind: 'photo' | 'audio') {
    const file = (event.target as HTMLInputElement).files?.[0] || null
    if (file && file.size > (kind === 'photo' ? 8 : 20) * 1024 * 1024) { this.error = 'O arquivo excede o limite permitido.'; return }
    if (kind === 'photo') { this.photoFile = file; this.photoDraft = null; this.photoRows = []; this.reviewedPhoto = false }
    else { this.audioFile = file; this.evolutionDraft = null; this.reviewedEvolution = false }
  }

  async readPhoto() {
    if (!this.canGenerate || !this.photoFile) return
    await this.run(async () => {
      const body = new FormData()
      body.append('file', this.photoFile!)
      body.append('referenceDate', this.referenceDate)
      body.append('consent', 'true')
      this.photoDraft = await firstValueFrom(this.http.post<Draft>('/api/assistant/photo', body))
      const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      this.photoRows = (this.photoDraft.content.appointments || []).map(row => {
        const matching = this.workspace!.patients.filter(p => normalize(p.name) === normalize(row.patientName))
        return { ...row, patientId: matching.length === 1 ? matching[0].id : '', dentistId: '', selected: true }
      })
      this.reviewedPhoto = false
      if (!this.photoRows.length) this.notice = 'Nenhum horário legível foi encontrado. Tente uma foto mais nítida.'
    })
  }

  async saveAppointments() {
    if (!this.photoDraft || !this.reviewedPhoto || !this.selectedRows.length) return
    if (this.selectedRows.some(row => !row.patientId || !row.startLocal || !row.endLocal)) { this.error = 'Vincule os pacientes e preencha o início e o fim de cada linha selecionada.'; return }
    await this.run(async () => {
      const result = await firstValueFrom(this.http.post<{ count: number }>(`/api/assistant/drafts/${this.photoDraft!.id}/appointments`, {
        reviewed: true, appointments: this.selectedRows.map(row => ({ patientId: row.patientId, dentistId: row.dentistId || undefined, startLocal: row.startLocal, endLocal: row.endLocal, notes: row.procedure }))
      }))
      this.notice = `${result.count} consulta(s) salva(s) na agenda.`
      this.photoDraft = null
      this.photoRows = []
    })
  }

  async startRecording() {
    this.error = ''
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { this.error = 'Seu navegador não permite gravar aqui. Envie um arquivo de áudio ou digite o ditado.'; return }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (this.destroyed) { this.stream.getTracks().forEach(t => t.stop()); return }
      const chunks: Blob[] = []
      const mime = ['audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type))
      this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : {})
      this.recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      this.recorder.onstop = () => {
        const type = this.recorder?.mimeType.split(';')[0] || 'audio/webm'
        this.audioFile = new File(chunks, type.includes('mp4') ? 'ditado.mp4' : 'ditado.webm', { type })
        this.stream?.getTracks().forEach(t => t.stop())
        this.recording = false
      }
      this.recorder.start()
      this.recording = true
      this.recordingTimer = setTimeout(() => this.stopRecording(), 120_000)
    } catch { this.error = 'Não foi possível acessar o microfone. Confira a permissão ou envie um áudio.' }
  }

  stopRecording() {
    if (this.recordingTimer) clearTimeout(this.recordingTimer)
    if (this.recorder?.state === 'recording') this.recorder.stop()
  }

  async generateEvolution() {
    if (!this.canGenerate || !this.patientId || (!this.audioFile && !this.dictation.trim())) return
    await this.run(async () => {
      const body = new FormData()
      body.append('patientId', this.patientId)
      body.append('consent', 'true')
      if (this.audioFile) body.append('file', this.audioFile)
      else body.append('dictation', this.dictation)
      this.evolutionDraft = await firstValueFrom(this.http.post<Draft>('/api/assistant/evolution', body))
      this.evolutionText = this.evolutionDraft.content.text || ''
      this.reviewedEvolution = false
    })
  }

  async saveEvolution() {
    if (!this.evolutionDraft || !this.reviewedEvolution || !this.evolutionText.trim()) return
    await this.run(async () => {
      await firstValueFrom(this.http.post(`/api/assistant/drafts/${this.evolutionDraft!.id}/evolution`, { reviewed: true, text: this.evolutionText }))
      this.notice = 'Evolução revisada salva no prontuário, com sua autoria e data de revisão.'
      this.evolutionDraft = null
      this.dictation = ''
      this.audioFile = null
    })
  }

  async saveEstimate() {
    if (!this.estimate.patientId || !this.estimate.title.trim() || !Number.isFinite(this.estimate.amount) || this.estimate.amount < 0) { this.error = 'Escolha o paciente, o título e um valor válido.'; return }
    await this.run(async () => {
      await firstValueFrom(this.http.post('/api/assistant/estimates', { patientId: this.estimate.patientId, title: this.estimate.title, amountCents: Math.round(this.estimate.amount * 100), proposedAt: this.estimate.proposedAt, notes: this.estimate.notes }))
      this.estimate = { patientId: '', title: '', amount: 0, proposedAt: this.workspace!.today, notes: '' }
      this.notice = 'Orçamento registrado para acompanhamento. Nenhuma cobrança foi criada.'
      await this.load()
    })
  }

  async estimateStatus(id: string, status: string) {
    await this.run(async () => { await firstValueFrom(this.http.patch(`/api/assistant/estimates/${id}`, { status })); await this.load(); this.notice = 'Situação do orçamento atualizada.' })
  }

  async saveRecall() {
    if (!this.recall.patientId) { this.error = 'Escolha um paciente para configurar o retorno.'; return }
    await this.run(async () => {
      await firstValueFrom(this.http.patch(`/api/assistant/recalls/${this.recall.patientId}`, { intervalMonths: this.recall.intervalMonths, dueDate: this.recall.dueDate || undefined }))
      await this.load()
      this.notice = 'Prazo de retorno atualizado.'
    })
  }

  async generateMessage(kind: 'ESTIMATE' | 'PLAN' | 'RECALL', targetId: string) {
    if (!this.canGenerate) return
    await this.run(async () => {
      this.messageDraft = await firstValueFrom(this.http.post<Draft>('/api/assistant/messages', { kind, targetId, consent: 'true' }))
      this.messageText = this.messageDraft.content.message || ''
      this.reviewedMessage = false
      this.whatsappUrl = ''
    })
  }

  async prepareWhatsapp() {
    if (!this.messageDraft || !this.reviewedMessage || !this.messageText.trim()) return
    await this.run(async () => {
      const result = await firstValueFrom(this.http.post<{ url: string }>(`/api/assistant/drafts/${this.messageDraft!.id}/whatsapp`, { text: this.messageText, reviewed: true }))
      this.whatsappUrl = result.url
      this.messageDraft = null
      this.notice = 'Mensagem preparada. Abra o WhatsApp e clique em Enviar para concluir o contato.'
    })
  }

  async generateWeekly() {
    if (!this.canGenerate) return
    await this.run(async () => { this.weekly = await firstValueFrom(this.http.post('/api/assistant/weekly', { consent: 'true' })) })
  }

  async toggleWeekly() {
    if (!this.canGenerate || !this.weekly) return
    await this.run(async () => {
      const result = await firstValueFrom(this.http.post<{ weeklyEnabled: boolean }>('/api/assistant/weekly-settings', { consent: 'true', enabled: !this.weekly.weeklyEnabled }))
      this.weekly.weeklyEnabled = result.weeklyEnabled
      this.notice = result.weeklyEnabled ? 'Resumo automático ativado. Toda segunda-feira, indicadores agregados serão analisados e o resumo ficará disponível aqui.' : 'Resumo automático desativado.'
      if (result.weeklyEnabled && !this.weekly.summary) this.weekly = await firstValueFrom(this.http.post('/api/assistant/weekly', { consent: 'true' }))
    })
  }
}
