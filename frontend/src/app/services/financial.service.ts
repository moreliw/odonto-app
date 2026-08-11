import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'

export type FinancialRole = 'ADMIN' | 'DENTIST'
export type EffectiveStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'BOLETO' | 'OTHER'

export type ClinicService = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  price: number
  durationMinutes?: number | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type InvoicePayment = {
  id: string
  amount: number
  paidAt: string
  method: PaymentMethod
  notes?: string | null
}

export type InvoiceItem = {
  id?: string
  serviceId?: string | null
  service?: { id: string; name: string } | null
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export type ClinicInvoice = {
  id: string
  patientId: string
  patient: { id: string; name: string; phone?: string | null }
  dentistId?: string | null
  dentist?: { id: string; name: string } | null
  /** Nome do dentista sem conta no sistema (só quando dentistId é nulo). */
  dentistName?: string | null
  description: string
  amount: number
  discount: number
  paidAmount: number
  remainingAmount: number
  status: EffectiveStatus
  effectiveStatus: EffectiveStatus
  issuedAt: string
  dueDate: string
  notes?: string | null
  items: InvoiceItem[]
  payments: InvoicePayment[]
  createdAt: string
  updatedAt: string
}

export type Expense = {
  id: string
  description: string
  category?: string | null
  supplier?: string | null
  amount: number
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  effectiveStatus: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  issuedAt: string
  dueDate: string
  paidAt?: string | null
  paymentMethod?: PaymentMethod | null
  recurring: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type FinancialSummary = {
  role: FinancialRole
  period: { from: string; to: string }
  kpis: {
    revenue: number
    expenses: number
    balance: number
    receivable: number
    overdue: number
    payable: number
    averageTicket: number
  }
  counts: { pending: number; partial: number; overdue: number; paid: number }
  cashFlow: Array<{ label: string; income: number; expense: number }>
  topServices: Array<{ name: string; quantity: number; total: number }>
  paymentMethods: Array<{ method: PaymentMethod; amount: number }>
  recentMovements: Array<{
    id: string
    type: 'INCOME' | 'EXPENSE'
    description: string
    detail: string
    amount: number
    date: string
    method?: PaymentMethod | null
  }>
  upcomingReceivables: ClinicInvoice[]
  overdueReceivables: ClinicInvoice[]
}

export type FinancialFilters = { search?: string; status?: string; from?: string; to?: string }

@Injectable({ providedIn: 'root' })
export class FinancialService {
  private readonly base = '/api/financial'

  constructor(private readonly http: HttpClient) {}

  private params(values: Record<string, string | undefined>) {
    let params = new HttpParams()
    Object.entries(values).forEach(([key, value]) => {
      if (value) params = params.set(key, value)
    })
    return params
  }

  summary(from: string, to: string) {
    return this.http.get<FinancialSummary>(`${this.base}/summary`, { params: this.params({ from, to }) })
  }

  invoices(filters: FinancialFilters = {}) {
    return this.http.get<ClinicInvoice[]>(`${this.base}/invoices`, { params: this.params(filters) })
  }

  createInvoice(data: Record<string, unknown>) {
    return this.http.post<ClinicInvoice>(`${this.base}/invoices`, data)
  }

  updateInvoice(id: string, data: Record<string, unknown>) {
    return this.http.patch<ClinicInvoice>(`${this.base}/invoices/${id}`, data)
  }

  addPayment(id: string, data: Record<string, unknown>) {
    return this.http.post<ClinicInvoice>(`${this.base}/invoices/${id}/payments`, data)
  }

  removePayment(invoiceId: string, paymentId: string) {
    return this.http.delete<ClinicInvoice>(`${this.base}/invoices/${invoiceId}/payments/${paymentId}`)
  }

  cancelInvoice(id: string) {
    return this.http.post<ClinicInvoice>(`${this.base}/invoices/${id}/cancel`, {})
  }

  deleteInvoice(id: string) {
    return this.http.delete<{ ok: boolean }>(`${this.base}/invoices/${id}`)
  }

  expenses(filters: FinancialFilters = {}) {
    return this.http.get<Expense[]>(`${this.base}/expenses`, { params: this.params(filters) })
  }

  createExpense(data: Record<string, unknown>) {
    return this.http.post<Expense>(`${this.base}/expenses`, data)
  }

  updateExpense(id: string, data: Record<string, unknown>) {
    return this.http.patch<Expense>(`${this.base}/expenses/${id}`, data)
  }

  payExpense(id: string, data: Record<string, unknown>) {
    return this.http.post<Expense>(`${this.base}/expenses/${id}/pay`, data)
  }

  reopenExpense(id: string) {
    return this.http.post<Expense>(`${this.base}/expenses/${id}/reopen`, {})
  }

  cancelExpense(id: string) {
    return this.http.post<Expense>(`${this.base}/expenses/${id}/cancel`, {})
  }

  deleteExpense(id: string) {
    return this.http.delete<{ ok: boolean }>(`${this.base}/expenses/${id}`)
  }

  services(includeInactive = false) {
    return this.http.get<ClinicService[]>(`${this.base}/services`, { params: this.params({ includeInactive: String(includeInactive) }) })
  }

  createService(data: Record<string, unknown>) {
    return this.http.post<ClinicService>(`${this.base}/services`, data)
  }

  updateService(id: string, data: Record<string, unknown>) {
    return this.http.patch<ClinicService>(`${this.base}/services/${id}`, data)
  }

  deleteService(id: string) {
    return this.http.delete<{ ok?: boolean; archived?: boolean }>(`${this.base}/services/${id}`)
  }
}
