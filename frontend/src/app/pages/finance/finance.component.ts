import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { forkJoin, of, Subscription } from 'rxjs'
import { AuthService } from '../../services/auth.service'
import {
  ClinicInvoice,
  ClinicService,
  EffectiveStatus,
  Expense,
  FinancialService,
  FinancialSummary,
  PaymentMethod
} from '../../services/financial.service'
import { PrivacyService } from '../../services/privacy.service'
import { ToastService } from '../../services/toast.service'
import { SearchableSelectComponent } from '../../components/searchable-select/searchable-select.component'

type FinanceTab = 'overview' | 'receivables' | 'expenses' | 'services'
type PatientOption = { id: string; name: string; phone?: string | null }
type DentistOption = { id: string; name: string }
type InvoiceFormItem = { serviceId: string; description: string; quantity: number; unitPrice: number }

const STATUS_LABEL: Record<EffectiveStatus, string> = {
  PENDING: 'Pendente',
  PARTIAL: 'Parcial',
  PAID: 'Recebida',
  OVERDUE: 'Em atraso',
  CANCELLED: 'Cancelada'
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BANK_TRANSFER: 'Transferência',
  BOLETO: 'Boleto',
  OTHER: 'Outro'
}

@Component({
  selector: 'app-finance',
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.css'
})
export class FinanceComponent implements OnInit, OnDestroy {
  readonly statusLabel = STATUS_LABEL
  readonly methodLabel = METHOD_LABEL
  readonly paymentMethods = Object.entries(METHOD_LABEL) as Array<[PaymentMethod, string]>
  readonly expenseCategories = ['Materiais odontológicos', 'Laboratório', 'Equipe e comissões', 'Aluguel', 'Impostos e taxas', 'Marketing', 'Manutenção', 'Tecnologia', 'Outros']
  readonly serviceCategories = ['Consulta', 'Prevenção', 'Dentística', 'Endodontia', 'Periodontia', 'Prótese', 'Implantodontia', 'Ortodontia', 'Cirurgia', 'Estética', 'Outros']

  isAdmin = false
  activeTab: FinanceTab = 'overview'
  loading = false
  saving = false
  error = ''
  hideValues = false
  search = ''
  statusFilter = 'ALL'
  period = 'month'
  from = ''
  to = ''

  summary: FinancialSummary | null = null
  invoices: ClinicInvoice[] = []
  expenses: Expense[] = []
  services: ClinicService[] = []
  patients: PatientOption[] = []
  dentists: DentistOption[] = []

  get patientItems() {
    return this.patients.map(p => ({ id: p.id, label: p.name, sublabel: p.phone || undefined }))
  }

  get dentistItems() {
    return this.dentists.map(d => ({ id: d.id, label: d.name }))
  }

  invoiceModal = false
  invoiceDetailsModal = false
  paymentModal = false
  expenseModal = false
  expensePaymentModal = false
  serviceModal = false
  editingInvoiceId: string | null = null
  editingExpenseId: string | null = null
  editingServiceId: string | null = null
  selectedInvoice: ClinicInvoice | null = null
  selectedExpense: Expense | null = null

  invoiceForm = this.emptyInvoiceForm()
  paymentForm: { amount: number; paidAt: string; method: PaymentMethod; notes: string } = {
    amount: 0,
    paidAt: this.todayInput(),
    method: 'PIX',
    notes: ''
  }
  expenseForm = this.emptyExpenseForm()
  expensePaymentForm: { paidAt: string; method: PaymentMethod } = { paidAt: this.todayInput(), method: 'PIX' }
  serviceForm = this.emptyServiceForm()

  private privacySub: Subscription | null = null
  private searchTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly api: FinancialService,
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    readonly privacy: PrivacyService,
    private readonly toast: ToastService
  ) {
    this.isAdmin = this.auth.isAdmin()
  }

  ngOnInit() {
    this.setPeriod('month', false)
    this.privacySub = this.privacy.hidden.subscribe(hidden => this.hideValues = hidden)
    this.loadAll()
  }

  ngOnDestroy() {
    this.privacySub?.unsubscribe()
    if (this.searchTimer) clearTimeout(this.searchTimer)
  }

  setPeriod(period: string, reload = true) {
    this.period = period
    const now = new Date()
    let start = new Date(now.getFullYear(), now.getMonth(), 1)
    if (period === 'quarter') start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    if (period === 'year') start = new Date(now.getFullYear(), 0, 1)
    this.from = this.toDateInput(start)
    this.to = this.toDateInput(now)
    if (reload) this.loadAll()
  }

  applyCustomPeriod() {
    this.period = 'custom'
    this.loadAll()
  }

  selectTab(tab: FinanceTab) {
    if (tab === 'expenses' && !this.isAdmin) return
    this.activeTab = tab
    this.search = ''
    this.statusFilter = 'ALL'
  }

  loadAll() {
    this.loading = true
    this.error = ''
    forkJoin({
      summary: this.api.summary(this.from, this.to),
      invoices: this.api.invoices(),
      services: this.api.services(this.isAdmin),
      patients: this.http.get<PatientOption[]>('/api/patients'),
      expenses: this.isAdmin ? this.api.expenses() : of([] as Expense[]),
      dentists: this.isAdmin ? this.http.get<DentistOption[]>('/api/users?role=DENTIST') : of([] as DentistOption[])
    }).subscribe({
      next: result => {
        this.summary = result.summary
        this.invoices = result.invoices
        this.services = result.services
        this.patients = result.patients
        this.expenses = result.expenses
        this.dentists = result.dentists
        this.loading = false
      },
      error: error => {
        this.loading = false
        this.error = this.errorMessage(error, 'Não foi possível carregar o financeiro agora.')
      }
    })
  }

  refreshList() {
    if (this.activeTab === 'receivables') this.loadInvoices()
    if (this.activeTab === 'expenses' && this.isAdmin) this.loadExpenses()
  }

  searchChanged() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => this.refreshList(), 300)
  }

  loadInvoices() {
    this.loading = true
    this.api.invoices({ search: this.search, status: this.statusFilter }).subscribe({
      next: invoices => { this.invoices = invoices; this.loading = false },
      error: error => { this.loading = false; this.toast.error('Falha ao carregar cobranças', this.errorMessage(error)) }
    })
  }

  loadExpenses() {
    this.loading = true
    this.api.expenses({ search: this.search, status: this.statusFilter }).subscribe({
      next: expenses => { this.expenses = expenses; this.loading = false },
      error: error => { this.loading = false; this.toast.error('Falha ao carregar despesas', this.errorMessage(error)) }
    })
  }

  money(value: number | null | undefined) {
    if (this.hideValues) return 'R$ ••••••'
    return this.moneyPlain(value)
  }

  /** Sempre visível, mesmo com "Esconder valores" ativo — usar apenas dentro de formulários (o usuário está digitando o próprio valor). */
  moneyPlain(value: number | null | undefined) {
    return (Number(value || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  compactMoney(value: number) {
    if (this.hideValues) return '•••'
    if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    return this.money(value)
  }

  statusClass(status: string) {
    return ({ PAID: 'success', PENDING: 'pending', PARTIAL: 'partial', OVERDUE: 'overdue', CANCELLED: 'cancelled' } as Record<string, string>)[status] || 'pending'
  }

  statusText(status: string) {
    return STATUS_LABEL[status as EffectiveStatus] || status
  }

  methodText(method?: PaymentMethod | null) {
    return method ? METHOD_LABEL[method] : 'Não informado'
  }

  maxCashFlow() {
    return Math.max(1, ...(this.summary?.cashFlow || []).flatMap(item => [item.income, item.expense]))
  }

  chartHeight(value: number) {
    return `${Math.max(value > 0 ? 8 : 2, (value / this.maxCashFlow()) * 100)}%`
  }

  openInvoice(invoice?: ClinicInvoice) {
    this.editingInvoiceId = invoice?.id || null
    this.invoiceForm = invoice ? {
      patientId: invoice.patientId,
      dentistId: invoice.dentistId || '',
      description: invoice.description,
      discount: invoice.discount,
      issuedAt: this.toDateInput(new Date(invoice.issuedAt)),
      dueDate: this.toDateInput(new Date(invoice.dueDate)),
      notes: invoice.notes || '',
      items: invoice.items.length
        ? invoice.items.map(item => ({ serviceId: item.serviceId || '', description: item.description, quantity: item.quantity, unitPrice: Number(item.unitPrice) }))
        : [{ serviceId: '', description: invoice.description, quantity: 1, unitPrice: invoice.amount + invoice.discount }]
    } : this.emptyInvoiceForm()
    this.invoiceModal = true
  }

  addInvoiceItem() {
    this.invoiceForm.items.push({ serviceId: '', description: '', quantity: 1, unitPrice: 0 })
  }

  removeInvoiceItem(index: number) {
    if (this.invoiceForm.items.length === 1) return
    this.invoiceForm.items.splice(index, 1)
  }

  serviceSelected(item: InvoiceFormItem) {
    const service = this.services.find(entry => entry.id === item.serviceId)
    if (!service) return
    item.description = service.name
    item.unitPrice = Number(service.price)
  }

  invoiceGross() {
    return this.invoiceForm.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.unitPrice || 0)), 0)
  }

  invoiceTotal() {
    return Math.max(0, this.invoiceGross() - Number(this.invoiceForm.discount || 0))
  }

  saveInvoice() {
    if (!this.invoiceForm.patientId || !this.invoiceForm.dueDate || this.invoiceTotal() <= 0) {
      this.toast.warning('Revise a cobrança', 'Informe paciente, vencimento e ao menos um serviço com valor.')
      return
    }
    const data = {
      patientId: this.invoiceForm.patientId,
      dentistId: this.invoiceForm.dentistId || undefined,
      description: this.invoiceForm.description || this.invoiceForm.items[0]?.description || 'Cobrança odontológica',
      discount: Number(this.invoiceForm.discount || 0),
      issuedAt: this.apiDate(this.invoiceForm.issuedAt),
      dueDate: this.apiDate(this.invoiceForm.dueDate),
      notes: this.invoiceForm.notes || undefined,
      items: this.invoiceForm.items.map(item => ({
        serviceId: item.serviceId || undefined,
        description: item.description,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0)
      }))
    }
    this.saving = true
    const request = this.editingInvoiceId ? this.api.updateInvoice(this.editingInvoiceId, data) : this.api.createInvoice(data)
    request.subscribe({
      next: () => {
        this.saving = false
        this.invoiceModal = false
        this.toast.success(this.editingInvoiceId ? 'Cobrança atualizada' : 'Cobrança criada', 'O controle financeiro já foi atualizado.')
        this.loadAll()
      },
      error: error => { this.saving = false; this.toast.error('Não foi possível salvar', this.errorMessage(error)) }
    })
  }

  openPayment(invoice: ClinicInvoice) {
    this.selectedInvoice = invoice
    this.paymentForm = { amount: invoice.remainingAmount, paidAt: this.todayInput(), method: 'PIX', notes: '' }
    this.paymentModal = true
  }

  openInvoiceDetails(invoice: ClinicInvoice) {
    this.selectedInvoice = invoice
    this.invoiceDetailsModal = true
  }

  removeInvoicePayment(paymentId: string) {
    if (!this.isAdmin || !this.selectedInvoice || !confirm('Estornar este recebimento? O valor voltará para o saldo em aberto.')) return
    this.saving = true
    this.api.removePayment(this.selectedInvoice.id, paymentId).subscribe({
      next: invoice => {
        this.saving = false
        this.selectedInvoice = invoice
        this.toast.success('Recebimento estornado', 'O saldo da cobrança foi recalculado.')
        this.loadAll()
      },
      error: error => { this.saving = false; this.toast.error('Não foi possível estornar', this.errorMessage(error)) }
    })
  }

  savePayment() {
    if (!this.selectedInvoice || this.paymentForm.amount <= 0 || this.paymentForm.amount > this.selectedInvoice.remainingAmount) {
      this.toast.warning('Valor inválido', 'O recebimento não pode ultrapassar o saldo em aberto.')
      return
    }
    this.saving = true
    this.api.addPayment(this.selectedInvoice.id, {
      ...this.paymentForm,
      paidAt: this.apiDate(this.paymentForm.paidAt)
    }).subscribe({
      next: () => {
        this.saving = false
        this.paymentModal = false
        this.toast.success('Recebimento registrado', 'O saldo da cobrança foi atualizado.')
        this.loadAll()
      },
      error: error => { this.saving = false; this.toast.error('Não foi possível receber', this.errorMessage(error)) }
    })
  }

  cancelInvoice(invoice: ClinicInvoice) {
    if (!confirm(`Cancelar a cobrança de ${invoice.patient.name}?`)) return
    this.api.cancelInvoice(invoice.id).subscribe({
      next: () => { this.toast.success('Cobrança cancelada'); this.loadAll() },
      error: error => this.toast.error('Não foi possível cancelar', this.errorMessage(error))
    })
  }

  deleteInvoice(invoice: ClinicInvoice) {
    if (!confirm('Excluir definitivamente esta cobrança? Esta ação não pode ser desfeita.')) return
    this.api.deleteInvoice(invoice.id).subscribe({
      next: () => { this.toast.success('Cobrança excluída'); this.loadAll() },
      error: error => this.toast.error('Não foi possível excluir', this.errorMessage(error))
    })
  }

  openExpense(expense?: Expense) {
    if (!this.isAdmin) return
    this.editingExpenseId = expense?.id || null
    this.expenseForm = expense ? {
      description: expense.description,
      category: expense.category || '',
      supplier: expense.supplier || '',
      amount: Number(expense.amount),
      issuedAt: this.toDateInput(new Date(expense.issuedAt)),
      dueDate: this.toDateInput(new Date(expense.dueDate)),
      recurring: expense.recurring,
      notes: expense.notes || ''
    } : this.emptyExpenseForm()
    this.expenseModal = true
  }

  saveExpense() {
    if (!this.expenseForm.description.trim() || this.expenseForm.amount <= 0 || !this.expenseForm.dueDate) {
      this.toast.warning('Revise a despesa', 'Informe descrição, valor e vencimento.')
      return
    }
    const data = {
      ...this.expenseForm,
      amount: Number(this.expenseForm.amount),
      issuedAt: this.apiDate(this.expenseForm.issuedAt),
      dueDate: this.apiDate(this.expenseForm.dueDate)
    }
    this.saving = true
    const request = this.editingExpenseId ? this.api.updateExpense(this.editingExpenseId, data) : this.api.createExpense(data)
    request.subscribe({
      next: () => {
        this.saving = false
        this.expenseModal = false
        this.toast.success(this.editingExpenseId ? 'Despesa atualizada' : 'Despesa criada')
        this.loadAll()
      },
      error: error => { this.saving = false; this.toast.error('Não foi possível salvar', this.errorMessage(error)) }
    })
  }

  openExpensePayment(expense: Expense) {
    this.selectedExpense = expense
    this.expensePaymentForm = { paidAt: this.todayInput(), method: 'PIX' }
    this.expensePaymentModal = true
  }

  saveExpensePayment() {
    if (!this.selectedExpense) return
    this.saving = true
    this.api.payExpense(this.selectedExpense.id, { ...this.expensePaymentForm, paidAt: this.apiDate(this.expensePaymentForm.paidAt) }).subscribe({
      next: () => {
        this.saving = false
        this.expensePaymentModal = false
        this.toast.success('Pagamento registrado')
        this.loadAll()
      },
      error: error => { this.saving = false; this.toast.error('Não foi possível registrar', this.errorMessage(error)) }
    })
  }

  reopenExpense(expense: Expense) {
    if (!confirm('Estornar o pagamento desta despesa? Ela voltará para contas a pagar.')) return
    this.api.reopenExpense(expense.id).subscribe({
      next: () => { this.toast.success('Pagamento estornado'); this.loadAll() },
      error: error => this.toast.error('Não foi possível estornar', this.errorMessage(error))
    })
  }

  cancelExpense(expense: Expense) {
    if (!confirm(`Cancelar a despesa “${expense.description}”?`)) return
    this.api.cancelExpense(expense.id).subscribe({
      next: () => { this.toast.success('Despesa cancelada'); this.loadAll() },
      error: error => this.toast.error('Não foi possível cancelar', this.errorMessage(error))
    })
  }

  deleteExpense(expense: Expense) {
    if (!confirm('Excluir definitivamente esta despesa?')) return
    this.api.deleteExpense(expense.id).subscribe({
      next: () => { this.toast.success('Despesa excluída'); this.loadAll() },
      error: error => this.toast.error('Não foi possível excluir', this.errorMessage(error))
    })
  }

  openService(service?: ClinicService) {
    if (!this.isAdmin) return
    this.editingServiceId = service?.id || null
    this.serviceForm = service ? {
      name: service.name,
      category: service.category || '',
      price: Number(service.price),
      durationMinutes: service.durationMinutes || 30,
      description: service.description || '',
      active: service.active
    } : this.emptyServiceForm()
    this.serviceModal = true
  }

  saveService() {
    if (!this.serviceForm.name.trim() || this.serviceForm.price < 0) {
      this.toast.warning('Revise o serviço', 'Informe nome e valor válido.')
      return
    }
    this.saving = true
    const request = this.editingServiceId ? this.api.updateService(this.editingServiceId, this.serviceForm) : this.api.createService(this.serviceForm)
    request.subscribe({
      next: () => {
        this.saving = false
        this.serviceModal = false
        this.toast.success(this.editingServiceId ? 'Serviço atualizado' : 'Serviço adicionado')
        this.loadAll()
      },
      error: error => { this.saving = false; this.toast.error('Não foi possível salvar', this.errorMessage(error)) }
    })
  }

  archiveService(service: ClinicService) {
    if (!confirm(`${service.active ? 'Arquivar' : 'Excluir'} o serviço “${service.name}”?`)) return
    this.api.deleteService(service.id).subscribe({
      next: () => { this.toast.success('Serviço removido do catálogo ativo'); this.loadAll() },
      error: error => this.toast.error('Não foi possível remover', this.errorMessage(error))
    })
  }

  exportCsv() {
    const rows: string[][] = [['Tipo', 'Descrição', 'Paciente/Fornecedor', 'Vencimento', 'Status', 'Valor', 'Pago', 'Saldo']]
    this.invoices.forEach(invoice => rows.push([
      'Cobrança', invoice.description, invoice.patient.name, this.toDateInput(new Date(invoice.dueDate)),
      STATUS_LABEL[invoice.effectiveStatus], String(invoice.amount), String(invoice.paidAmount), String(invoice.remainingAmount)
    ]))
    if (this.isAdmin) this.expenses.forEach(expense => rows.push([
      'Despesa', expense.description, expense.supplier || '', this.toDateInput(new Date(expense.dueDate)),
      STATUS_LABEL[expense.effectiveStatus as EffectiveStatus], String(expense.amount), expense.status === 'PAID' ? String(expense.amount) : '0', '0'
    ]))
    const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `financeiro-${this.from}-${this.to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  private emptyInvoiceForm() {
    return {
      patientId: '', dentistId: '', description: '', discount: 0,
      issuedAt: this.todayInput(), dueDate: this.dateOffsetInput(7), notes: '',
      items: [{ serviceId: '', description: '', quantity: 1, unitPrice: 0 }] as InvoiceFormItem[]
    }
  }

  private emptyExpenseForm() {
    return {
      description: '', category: '', supplier: '', amount: 0,
      issuedAt: this.todayInput(), dueDate: this.dateOffsetInput(7), recurring: false, notes: ''
    }
  }

  private emptyServiceForm() {
    return { name: '', category: '', price: 0, durationMinutes: 30, description: '', active: true }
  }

  private todayInput() {
    return this.toDateInput(new Date())
  }

  private dateOffsetInput(days: number) {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return this.toDateInput(date)
  }

  private toDateInput(date: Date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 10)
  }

  private apiDate(value: string) {
    return `${value}T12:00:00.000Z`
  }

  private errorMessage(error: any, fallback = 'Tente novamente em instantes.') {
    const message = error?.error?.message
    return Array.isArray(message) ? message.join(' ') : (message || fallback)
  }
}
