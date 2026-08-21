export type PatientProfile = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  birthDate?: string | null
  document?: string | null
  gender?: string | null
  photoUrl?: string | null
  postalCode?: string | null
  address?: string | null
  addressNumber?: string | null
  addressComplement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  profession?: string | null
  guardianName?: string | null
  insuranceName?: string | null
  insuranceNumber?: string | null
  notes?: string | null
  bloodType?: string | null
  allergies?: string | null
  medications?: string | null
  preexistingConditions?: string | null
  medicalNotes?: string | null
  createdByName?: string | null
  updatedByName?: string | null
  createdAt: string
  updatedAt: string
}

export type PatientAppointment = {
  id: string
  patientId: string
  dentistId?: string | null
  dentistName?: string | null
  dentist?: { id: string; name: string } | null
  startTime: string
  endTime: string
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  confirmationStatus?: string
  notes?: string | null
}

export type PatientRecord = {
  id: string
  patientId: string
  content: any
  createdByName?: string | null
  updatedByName?: string | null
  createdAt: string
  updatedAt?: string
}

export type PatientFile = {
  id: string
  patientId: string
  key: string
  url: string
  contentType: string
  size: number
  originalName?: string | null
  category?: string | null
  notes?: string | null
  uploadedByName?: string | null
  createdAt: string
}

export type PatientInvoice = {
  id: string
  description: string
  amount: number
  discount: number
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED'
  issuedAt: string
  dueDate: string
  notes?: string | null
  payments: Array<{ id: string; amount: number; paidAt: string; method: string }>
  items: Array<{ id: string; description: string; quantity: number; unitPrice: number; total: number }>
}

export type PatientWorkspace = {
  patient: PatientProfile
  appointments: PatientAppointment[]
  records: PatientRecord[]
  files: PatientFile[]
  invoices: PatientInvoice[]
  professionals: Array<{ id: string; name: string }>
}

export type PatientTab = 'overview' | 'personal' | 'odontogram' | 'treatments' | 'records' | 'files' | 'financial' | 'history'

