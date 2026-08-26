import { CommonModule } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { firstValueFrom, forkJoin, of } from 'rxjs'
import { AuthService } from '../../services/auth.service'
import {
  EligibleFiscalInvoice,
  FiscalInvoice,
  FiscalReadiness,
  FiscalService,
  FiscalSettings,
  FiscalStatus,
  IssueFiscalInvoice
} from '../../services/fiscal.service'
import { ToastService } from '../../services/toast.service'

const STATUS_LABEL: Record<FiscalStatus, string> = {
  PROCESSING: 'Processando', AUTHORIZED: 'Autorizada', REJECTED: 'Rejeitada', ERROR: 'Falha',
  CANCEL_PENDING: 'Cancelando', CANCELLED: 'Cancelada'
}

@Component({
  selector: 'app-fiscal',
  imports: [CommonModule, FormsModule],
  templateUrl: './fiscal.component.html',
  styleUrl: './fiscal.component.css'
})
export class FiscalComponent implements OnInit {
  readonly statusLabel = STATUS_LABEL
  loading = true
  saving = ''
  error = ''
  search = ''
  statusFilter = 'ALL'
  page = 1
  readonly pageSize = 15
  canManage = false
  canConfigure = false
  notes: FiscalInvoice[] = []
  eligible: EligibleFiscalInvoice[] = []
  readiness: FiscalReadiness | null = null
  settings: FiscalSettings | null = null
  settingsForm = this.emptySettings()
  issueForm = this.emptyIssue()
  selectedInvoice: EligibleFiscalInvoice | null = null
  issueModal = false
  settingsModal = false
  cancelModal = false
  cancellingNote: FiscalInvoice | null = null
  cancellationReason = ''
  cancellationCode = '1'
  emissionConfirmed = false
  certificateFile: File | null = null
  certificatePassword = ''
  municipalLogin = ''
  municipalPassword = ''
  municipalToken = ''
  private requestedInvoiceId = ''

  constructor(
    private readonly api: FiscalService,
    private readonly auth: AuthService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute
  ) {
    this.canManage = this.auth.hasPermission('FISCAL_MANAGE')
    this.canConfigure = this.auth.hasPermission('FISCAL_CONFIGURE')
  }

  ngOnInit() {
    this.requestedInvoiceId = this.route.snapshot.queryParamMap.get('invoiceId') || ''
    this.load()
  }

  get filteredNotes() {
    const search = this.search.trim().toLocaleLowerCase('pt-BR')
    return this.notes.filter(note => {
      const statusMatches = this.statusFilter === 'ALL' || note.status === this.statusFilter
      const searchMatches = !search || [note.customerName, note.customerDocument, note.number, note.serviceDescription]
        .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(search))
      return statusMatches && searchMatches
    })
  }

  get pagedNotes() { return this.filteredNotes.slice((this.page - 1) * this.pageSize, this.page * this.pageSize) }
  get totalPages() { return Math.max(1, Math.ceil(this.filteredNotes.length / this.pageSize)) }
  get authorizedCount() { return this.notes.filter(note => note.status === 'AUTHORIZED').length }
  get processingCount() { return this.notes.filter(note => ['PROCESSING', 'CANCEL_PENDING'].includes(note.status)).length }
  get attentionCount() { return this.notes.filter(note => ['REJECTED', 'ERROR'].includes(note.status)).length }
  get totalAuthorized() { return this.notes.filter(note => note.status === 'AUTHORIZED').reduce((sum, note) => sum + note.amount, 0) }

  load(silent = false) {
    if (!silent) this.loading = true
    this.error = ''
    forkJoin({
      notes: this.api.list(),
      fiscal: this.api.settings(),
      eligible: this.canManage ? this.api.eligibleInvoices() : of([] as EligibleFiscalInvoice[])
    }).subscribe({
      next: result => {
        this.notes = result.notes
        this.settings = result.fiscal.settings
        this.readiness = result.fiscal.readiness
        this.eligible = result.eligible
        this.settingsForm = result.fiscal.settings ? this.normalizeSettings(result.fiscal.settings) : this.emptySettings()
        this.loading = false
        if (this.requestedInvoiceId && this.canManage) {
          const requested = this.eligible.find(invoice => invoice.id === this.requestedInvoiceId)
          this.requestedInvoiceId = ''
          if (requested) this.openIssue(requested)
        }
      },
      error: error => {
        this.loading = false
        this.error = this.errorMessage(error, 'Não foi possível carregar as notas fiscais.')
      }
    })
  }

  filterChanged() { this.page = 1 }

  openIssue(invoice?: EligibleFiscalInvoice) {
    if (!this.canManage) return
    this.issueForm = this.emptyIssue()
    this.emissionConfirmed = false
    this.issueModal = true
    const available = invoice || this.eligible.find(item => !item.activeFiscalInvoice) || this.eligible[0]
    if (available) {
      this.issueForm.invoiceId = available.id
      this.invoiceChanged()
    }
  }

  invoiceChanged() {
    this.selectedInvoice = this.eligible.find(invoice => invoice.id === this.issueForm.invoiceId) || null
    const invoice = this.selectedInvoice
    if (!invoice) return
    this.issueForm = {
      ...this.issueForm,
      invoiceId: invoice.id,
      serviceDate: (invoice.appointment?.startTime || invoice.issuedAt || new Date().toISOString()).slice(0, 10),
      serviceDescription: invoice.suggestedServiceDescription,
      nationalTaxCode: this.settings?.defaultNationalTaxCode || '',
      municipalTaxCode: this.settings?.defaultMunicipalTaxCode || '',
      cnae: this.settings?.defaultCnae || '',
      nbs: this.settings?.defaultNbs || '',
      issRate: this.settings?.defaultIssRate ?? null,
      issWithheld: Boolean(this.settings?.defaultIssWithheld),
      customerDocument: invoice.patient.document || '',
      customerEmail: invoice.patient.email || '',
      customerPhone: invoice.patient.phone || '',
      customerPostalCode: invoice.patient.postalCode || '',
      customerStreet: invoice.patient.street || '',
      customerNumber: invoice.patient.number || '',
      customerComplement: invoice.patient.complement || '',
      customerNeighborhood: invoice.patient.neighborhood || '',
      customerCity: invoice.patient.city || '',
      customerState: invoice.patient.state || '',
      customerCityCode: invoice.patient.cityCode || ''
    }
  }

  async issue() {
    if (!this.emissionConfirmed || !this.issueForm.invoiceId) return
    this.saving = 'issue'
    try {
      const note = await firstValueFrom(this.api.issue(this.issueForm))
      this.toast.success(note.status === 'AUTHORIZED' ? 'NFS-e autorizada com sucesso' : 'Emissão enviada para processamento')
      this.issueModal = false
      await this.reloadAsync()
    } catch (error: any) {
      this.toast.error('Não foi possível emitir a NFS-e', this.errorMessage(error))
    } finally { this.saving = '' }
  }

  openSettings() {
    if (!this.canConfigure) return
    this.settingsForm = this.settings ? this.normalizeSettings(this.settings) : this.emptySettings()
    this.settingsModal = true
  }

  async saveSettings() {
    this.saving = 'settings'
    try {
      const result = await firstValueFrom(this.api.saveSettings(this.settingsForm))
      this.settings = result.settings
      this.readiness = result.readiness
      this.settingsForm = this.normalizeSettings(result.settings)
      this.toast.success('Configuração fiscal salva')
    } catch (error: any) { this.toast.error('Não foi possível salvar', this.errorMessage(error)) }
    finally { this.saving = '' }
  }

  async syncProvider() {
    this.saving = 'provider'
    try {
      const saved = await firstValueFrom(this.api.saveSettings(this.settingsForm))
      this.settings = saved.settings
      this.readiness = saved.readiness
      const result = await firstValueFrom(this.api.syncProvider({
        municipalLogin: this.municipalLogin || undefined,
        municipalPassword: this.municipalPassword || undefined,
        municipalToken: this.municipalToken || undefined
      }))
      this.settings = result.settings
      this.readiness = result.readiness
      this.settingsForm = this.normalizeSettings(result.settings)
      this.municipalPassword = ''
      this.municipalToken = ''
      this.toast.success('Empresa e serviço NFS-e sincronizados')
    } catch (error: any) { this.toast.error('Falha ao sincronizar o provedor', this.errorMessage(error)) }
    finally { this.saving = '' }
  }

  selectCertificate(event: Event) {
    this.certificateFile = (event.target as HTMLInputElement).files?.[0] || null
  }

  async uploadCertificate() {
    if (!this.certificateFile || !this.certificatePassword) return
    this.saving = 'certificate'
    try {
      const saved = await firstValueFrom(this.api.saveSettings(this.settingsForm))
      this.settings = saved.settings
      this.readiness = saved.readiness
      if (!saved.readiness.companySynced) {
        this.toast.error('Sincronize a empresa antes de enviar o certificado')
        return
      }
      const result = await firstValueFrom(this.api.uploadCertificate(this.certificateFile, this.certificatePassword))
      this.settings = result.settings
      this.readiness = result.readiness
      this.settingsForm = this.normalizeSettings(result.settings)
      this.certificatePassword = ''
      this.certificateFile = null
      this.toast.success('Certificado A1 validado e enviado com segurança')
    } catch (error: any) { this.toast.error('Falha ao enviar o certificado', this.errorMessage(error)) }
    finally { this.saving = '' }
  }

  async syncNote(note: FiscalInvoice) {
    this.saving = `sync-${note.id}`
    try {
      await firstValueFrom(this.api.sync(note.id))
      this.toast.success('Status atualizado pelo provedor')
      await this.reloadAsync()
    } catch (error: any) { this.toast.error('Não foi possível atualizar a NFS-e', this.errorMessage(error)) }
    finally { this.saving = '' }
  }

  openCancel(note: FiscalInvoice) {
    this.cancellingNote = note
    this.cancellationReason = ''
    this.cancellationCode = '1'
    this.cancelModal = true
  }

  async cancel() {
    if (!this.cancellingNote || this.cancellationReason.trim().length < 15) return
    this.saving = 'cancel'
    try {
      await firstValueFrom(this.api.cancel(this.cancellingNote.id, this.cancellationReason.trim(), this.cancellationCode.trim() || '1'))
      this.toast.success('Cancelamento enviado ao provedor')
      this.cancelModal = false
      await this.reloadAsync()
    } catch (error: any) { this.toast.error('Não foi possível cancelar a NFS-e', this.errorMessage(error)) }
    finally { this.saving = '' }
  }

  async download(note: FiscalInvoice, kind: 'pdf' | 'xml') {
    this.saving = `${kind}-${note.id}`
    try {
      const blob = await firstValueFrom(kind === 'pdf' ? this.api.pdf(note.id) : this.api.xml(note.id))
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `nfse-${note.number || note.id}.${kind}`
      if (kind === 'pdf') anchor.target = '_blank'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (error: any) { this.toast.error('Documento indisponível', this.errorMessage(error)) }
    finally { this.saving = '' }
  }

  money(value: number) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
  statusClass(status: FiscalStatus) { return status.toLowerCase().replace('_', '-') }
  environmentLabel(value: string) { return value === 'PRODUCTION' ? 'Produção' : 'Homologação' }
  document(value: string) {
    const number = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (number.length === 11) return number.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    if (number.length === 14) return number.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, '$1.$2.$3/$4-$5')
    return value || 'Não informado'
  }

  private async reloadAsync() {
    const result = await firstValueFrom(forkJoin({
      notes: this.api.list(), fiscal: this.api.settings(), eligible: this.canManage ? this.api.eligibleInvoices() : of([] as EligibleFiscalInvoice[])
    }))
    this.notes = result.notes
    this.settings = result.fiscal.settings
    this.readiness = result.fiscal.readiness
    this.eligible = result.eligible
  }

  private emptySettings(): FiscalSettings {
    return {
      enabled: false, environment: 'SANDBOX', providerMode: 'NATIONAL', taxId: '', municipalRegistration: '', stateRegistration: '',
      legalName: '', tradeName: '', email: '', phone: '', postalCode: '', street: '', number: '', complement: '', neighborhood: '',
      city: '', state: '', cityCode: '', simpleNationalOption: 3, simpleNationalTaxRegime: 1, specialTaxRegime: 0,
      fiscalIncentive: false, rpsSeries: '1', rpsBatch: 1, rpsNumber: 1, defaultNationalTaxCode: '',
      defaultMunicipalTaxCode: '', defaultCnae: '', defaultNbs: '', defaultIssRate: null, defaultIssWithheld: false
    }
  }

  private emptyIssue(): IssueFiscalInvoice {
    return {
      invoiceId: '', serviceDate: new Date().toISOString().slice(0, 10), serviceDescription: '', nationalTaxCode: '', municipalTaxCode: '',
      cnae: '', nbs: '', issRate: null, issWithheld: false, customerDocument: '', customerEmail: '', customerPhone: '',
      customerPostalCode: '', customerStreet: '', customerNumber: '', customerComplement: '', customerNeighborhood: '', customerCity: '',
      customerState: '', customerCityCode: ''
    }
  }

  private normalizeSettings(settings: FiscalSettings): FiscalSettings {
    return { ...this.emptySettings(), ...settings, defaultIssRate: settings.defaultIssRate == null ? null : Number(settings.defaultIssRate) }
  }

  private errorMessage(error: any, fallback = 'Tente novamente em instantes.') {
    const message = error?.error?.message
    if (Array.isArray(message)) return message.join(' ')
    if (typeof message === 'string') return message
    if (typeof error?.error?.providerDetails?.message === 'string') return error.error.providerDetails.message
    return fallback
  }
}
