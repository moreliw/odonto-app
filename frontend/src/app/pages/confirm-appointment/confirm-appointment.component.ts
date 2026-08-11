import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute } from '@angular/router'
import { HttpClient } from '@angular/common/http'

type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
type ConfirmationStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED'

type ConfirmationData = {
  patientName: string
  dentistName: string | null
  clinicName: string | null
  primaryColor: string | null
  logoUrl: string | null
  startTime: string
  endTime: string
  appointmentStatus: AppointmentStatus
  confirmationStatus: ConfirmationStatus
}

/** Página pública (sem login) acessada pelo link de confirmação enviado por e-mail ao paciente. */
@Component({
    selector: 'app-confirm-appointment',
    imports: [CommonModule],
    template: `
    <div class="confirm-page">
      <div class="confirm-card">
        <div class="confirm-brand">
          @if (data?.logoUrl) {
            <img [src]="data!.logoUrl" alt="" width="40" height="40" />
          } @else {
            <div class="confirm-brand-mark" [style.background]="data?.primaryColor || '#2563eb'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V19a3 3 0 0 0 3 3c.7 0 1.32-.29 1.78-.75.35.35.85.75 1.72.75a3 3 0 0 0 3-3v-4.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7-1.09 0-2.13.25-3 .68A6.96 6.96 0 0 0 12 2z"/></svg>
            </div>
          }
          <strong>{{ data?.clinicName || 'OdontoApp' }}</strong>
        </div>

        @if (loading) {
          <div class="confirm-loading"><span class="spinner spinner-dark"></span></div>
        } @else if (error) {
          <div class="confirm-icon confirm-icon--neutral">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
          </div>
          <h1>Não foi possível abrir</h1>
          <p class="confirm-lead">{{ error }}</p>
        } @else if (data?.appointmentStatus === 'CANCELLED') {
          <div class="confirm-icon confirm-icon--neutral">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          </div>
          <h1>Consulta cancelada</h1>
          <p class="confirm-lead">Esta consulta foi cancelada pela clínica. Se tiver dúvidas, entre em contato diretamente.</p>
        } @else if (data?.appointmentStatus === 'COMPLETED') {
          <div class="confirm-icon confirm-icon--neutral">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <h1>Consulta já realizada</h1>
          <p class="confirm-lead">Este atendimento já aconteceu. Obrigado pela confiança!</p>
        } @else if (responded()) {
          <div class="confirm-icon" [class.confirm-icon--success]="data?.confirmationStatus === 'CONFIRMED'" [class.confirm-icon--declined]="data?.confirmationStatus === 'DECLINED'">
            @if (data?.confirmationStatus === 'CONFIRMED') {
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>
            } @else {
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m18 6-12 12M6 6l12 12"/></svg>
            }
          </div>
          <h1>{{ data?.confirmationStatus === 'CONFIRMED' ? 'Presença confirmada!' : 'Obrigado por avisar' }}</h1>
          <p class="confirm-lead">
            {{ data?.confirmationStatus === 'CONFIRMED'
              ? 'A clínica foi avisada. Nos vemos em breve!'
              : 'A clínica foi avisada e poderá entrar em contato para reagendar.' }}
          </p>
          <div class="confirm-detail-card">
            <div><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>{{ dateLabel }}</span></div>
            <div><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>{{ timeLabel }}</span></div>
            @if (data?.dentistName) {
              <div><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>{{ data?.dentistName }}</span></div>
            }
          </div>
          <button type="button" class="confirm-change-link" (click)="reset()">Mudar resposta</button>
        } @else if (data) {
          <h1>Olá, {{ data.patientName }}!</h1>
          <p class="confirm-lead">Você tem uma consulta agendada{{ data.clinicName ? ' em ' + data.clinicName : '' }}:</p>
          <div class="confirm-detail-card">
            <div><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>{{ dateLabel }}</span></div>
            <div><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>{{ timeLabel }}</span></div>
            @if (data.dentistName) {
              <div><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>{{ data.dentistName }}</span></div>
            }
          </div>
          <p class="confirm-question">Você poderá comparecer?</p>
          @if (respondError) {
            <p class="confirm-error">{{ respondError }}</p>
          }
          <div class="confirm-actions">
            <button type="button" class="btn btn-primary confirm-btn" [style.background]="data.primaryColor || null" [disabled]="responding" (click)="respond('CONFIRM')">
              @if (responding && pendingAction === 'CONFIRM') { <span class="spinner"></span> }
              Confirmar presença
            </button>
            <button type="button" class="btn btn-outline confirm-btn" [disabled]="responding" (click)="respond('DECLINE')">
              @if (responding && pendingAction === 'DECLINE') { <span class="spinner spinner-dark"></span> }
              Não poderei comparecer
            </button>
          </div>
        }
      </div>
      <p class="confirm-footer">Confirmação segura via OdontoApp</p>
    </div>
  `
})
export class ConfirmAppointmentComponent implements OnInit {
  data: ConfirmationData | null = null
  loading = true
  error = ''
  responding = false
  respondError = ''
  pendingAction: 'CONFIRM' | 'DECLINE' | null = null
  private manuallyReset = false

  private subdomain = ''
  private token = ''

  constructor(private readonly route: ActivatedRoute, private readonly http: HttpClient) {}

  ngOnInit() {
    this.subdomain = this.route.snapshot.paramMap.get('subdomain') || ''
    this.token = this.route.snapshot.paramMap.get('token') || ''
    this.load()
  }

  responded() {
    return !this.manuallyReset && this.data?.confirmationStatus !== 'PENDING'
  }

  get dateLabel() {
    if (!this.data) return ''
    const d = new Date(this.data.startTime)
    const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  get timeLabel() {
    if (!this.data) return ''
    const start = new Date(this.data.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const end = new Date(this.data.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${start} – ${end}`
  }

  private load() {
    this.loading = true
    this.error = ''
    this.http.get<ConfirmationData>(`/api/public/appointments/confirm/${this.subdomain}/${this.token}`).subscribe({
      next: res => {
        this.loading = false
        this.data = res
      },
      error: err => {
        this.loading = false
        this.error = err.error?.message || 'Este link de confirmação não é válido. Entre em contato com a clínica.'
      }
    })
  }

  reset() {
    this.manuallyReset = true
  }

  respond(action: 'CONFIRM' | 'DECLINE') {
    if (this.responding) return
    this.respondError = ''
    this.responding = true
    this.pendingAction = action
    this.http.post<ConfirmationData>(`/api/public/appointments/confirm/${this.subdomain}/${this.token}`, { action }).subscribe({
      next: res => {
        this.responding = false
        this.manuallyReset = false
        this.data = res
      },
      error: err => {
        this.responding = false
        this.respondError = err.error?.message || 'Não foi possível registrar sua resposta agora. Tente novamente.'
      }
    })
  }
}
