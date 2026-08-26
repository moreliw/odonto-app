import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'

export type FiscalEnvironment = 'SANDBOX' | 'PRODUCTION'
export type FiscalStatus = 'PROCESSING' | 'AUTHORIZED' | 'REJECTED' | 'ERROR' | 'CANCEL_PENDING' | 'CANCELLED'

export type FiscalSettings = {
  id?: string
  enabled: boolean
  environment: FiscalEnvironment
  providerMode: 'NATIONAL' | 'MUNICIPAL'
  taxId: string
  municipalRegistration: string
  stateRegistration: string
  legalName: string
  tradeName: string
  email: string
  phone: string
  postalCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  cityCode: string
  simpleNationalOption: number
  simpleNationalTaxRegime: number
  specialTaxRegime: number
  fiscalIncentive: boolean
  rpsSeries: string
  rpsBatch: number
  rpsNumber: number
  defaultNationalTaxCode: string
  defaultMunicipalTaxCode: string
  defaultCnae: string
  defaultNbs: string
  defaultIssRate: number | null
  defaultIssWithheld: boolean
  providerCompanySyncedAt?: string | null
  providerCompanyEnvironment?: FiscalEnvironment | null
  providerCompanyTaxId?: string | null
  certificateExpiresAt?: string | null
  certificateEnvironment?: FiscalEnvironment | null
  certificateTaxId?: string | null
  certificateSubject?: string | null
  updatedByName?: string | null
  updatedAt?: string
}

export type FiscalReadiness = {
  provider: string
  credentialsConfigured: boolean
  settingsConfigured: boolean
  enabled: boolean
  companySynced: boolean
  certificateConfigured: boolean
  certificateValid: boolean
  readyToIssue: boolean
}

export type FiscalEvent = {
  id: string
  action: string
  status?: string | null
  message?: string | null
  createdByName?: string | null
  createdAt: string
}

export type FiscalInvoice = {
  id: string
  invoiceId?: string | null
  invoice?: { id: string; description: string; appointmentId?: string | null } | null
  providerId?: string | null
  reference: string
  environment: FiscalEnvironment
  status: FiscalStatus
  number?: string | null
  verificationCode?: string | null
  accessKey?: string | null
  publicUrl?: string | null
  serviceDate: string
  serviceDescription: string
  amount: number
  nationalTaxCode: string
  municipalTaxCode?: string | null
  cnae?: string | null
  nbs?: string | null
  issRate?: number | null
  issWithheld: boolean
  customerName: string
  customerDocument: string
  customerEmail?: string | null
  lastMessage?: string | null
  issuedAt?: string | null
  cancelledAt?: string | null
  createdByName?: string | null
  updatedByName?: string | null
  events: FiscalEvent[]
  createdAt: string
  updatedAt: string
}

export type EligibleFiscalInvoice = {
  id: string
  description: string
  issuedAt: string
  amount: number
  appointment?: { id: string; startTime: string; endTime: string } | null
  patient: {
    name: string
    document?: string | null
    email?: string | null
    phone?: string | null
    postalCode?: string | null
    street?: string | null
    number?: string | null
    complement?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    cityCode?: string | null
  }
  suggestedServiceDescription: string
  activeFiscalInvoice?: { id: string; status: FiscalStatus; number?: string | null } | null
}

export type IssueFiscalInvoice = {
  invoiceId: string
  serviceDate: string
  serviceDescription: string
  nationalTaxCode: string
  municipalTaxCode?: string
  cnae?: string
  nbs?: string
  issRate?: number | null
  issWithheld: boolean
  customerDocument: string
  customerEmail?: string
  customerPhone?: string
  customerPostalCode?: string
  customerStreet?: string
  customerNumber?: string
  customerComplement?: string
  customerNeighborhood?: string
  customerCity?: string
  customerState?: string
  customerCityCode?: string
}

@Injectable({ providedIn: 'root' })
export class FiscalService {
  private readonly base = '/api/fiscal'
  constructor(private readonly http: HttpClient) {}

  list(filters: { search?: string; status?: string; from?: string; to?: string } = {}) {
    let params = new HttpParams()
    Object.entries(filters).forEach(([key, value]) => { if (value) params = params.set(key, value) })
    return this.http.get<FiscalInvoice[]>(this.base, { params })
  }

  settings() { return this.http.get<{ settings: FiscalSettings | null; readiness: FiscalReadiness }>(`${this.base}/settings`) }
  saveSettings(settings: FiscalSettings) { return this.http.put<{ settings: FiscalSettings; readiness: FiscalReadiness }>(`${this.base}/settings`, settings) }
  providerStatus() { return this.http.get<Record<string, unknown>>(`${this.base}/provider/status`) }
  syncProvider(credentials: { municipalLogin?: string; municipalPassword?: string; municipalToken?: string } = {}) {
    return this.http.post<{ settings: FiscalSettings; readiness: FiscalReadiness }>(`${this.base}/provider/sync`, credentials)
  }
  eligibleInvoices() { return this.http.get<EligibleFiscalInvoice[]>(`${this.base}/eligible-invoices`) }
  issue(data: IssueFiscalInvoice) { return this.http.post<FiscalInvoice>(this.base, data) }
  sync(id: string) { return this.http.post<FiscalInvoice>(`${this.base}/${id}/sync`, {}) }
  cancel(id: string, reason: string, code = '1') { return this.http.post<FiscalInvoice>(`${this.base}/${id}/cancel`, { reason, code }) }
  pdf(id: string) { return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' }) }
  xml(id: string) { return this.http.get(`${this.base}/${id}/xml`, { responseType: 'blob' }) }

  uploadCertificate(file: File, password: string) {
    const body = new FormData()
    body.append('file', file)
    body.append('password', password)
    return this.http.post<{ settings: FiscalSettings; readiness: FiscalReadiness }>(`${this.base}/provider/certificate`, body)
  }
}
