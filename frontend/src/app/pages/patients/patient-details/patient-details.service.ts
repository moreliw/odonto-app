import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { PatientProfile, PatientRecord, PatientWorkspace } from './patient-details.models'

@Injectable({ providedIn: 'root' })
export class PatientDetailsService {
  constructor(private readonly http: HttpClient) {}

  workspace(patientId: string) {
    return this.http.get<PatientWorkspace>(`/api/patients/${patientId}/workspace`)
  }

  updatePatient(patientId: string, patient: Partial<PatientProfile>) {
    return this.http.put<PatientProfile>(`/api/patients/${patientId}`, patient)
  }

  createRecord(patientId: string, content: Record<string, unknown>) {
    return this.http.post<PatientRecord>('/api/records', { patientId, content })
  }
}

