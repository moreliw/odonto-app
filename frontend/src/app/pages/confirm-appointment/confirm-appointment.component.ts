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
    <div
      class="confirm-page"
      [style.--confirm-accent]="data?.primaryColor || '#2563eb'"
      [style.--confirm-accent-contrast]="accentContrast"
    >
      <main
        class="confirm-card"
        [attr.aria-labelledby]="loading ? null : 'confirmation-title'"
        [attr.aria-label]="loading ? 'Confirmação de consulta' : null"
      >
        <header class="confirm-brand">
          <div class="confirm-logo-frame">
            <img
              class="confirm-logo"
              [src]="brandLogoUrl"
              [alt]="brandLogoAlt"
              width="60"
              height="60"
              decoding="async"
              (error)="useDefaultLogo($event)"
            />
          </div>
          <div class="confirm-brand-copy">
            <span>Confirmação de consulta</span>
            <strong>{{ data?.clinicName || 'OdontoApp' }}</strong>
          </div>
        </header>

        <div class="confirm-divider"></div>

        <section class="confirm-content" aria-live="polite">

          @if (loading) {
            <div class="confirm-loading">
              <span class="spinner spinner-dark" aria-hidden="true"></span>
              <span>Carregando sua consulta…</span>
            </div>
          } @else if (error) {
            <div class="confirm-status-icon confirm-status-icon--warning" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
            </div>
            <h1 id="confirmation-title">Não foi possível abrir</h1>
            <p class="confirm-lead">{{ error }}</p>
          } @else if (data?.appointmentStatus === 'CANCELLED') {
            <div class="confirm-status-icon confirm-status-icon--neutral" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
            </div>
            <h1 id="confirmation-title">Consulta cancelada</h1>
            <p class="confirm-lead">Esta consulta foi cancelada pela clínica. Em caso de dúvida, entre em contato diretamente.</p>
          } @else if (data?.appointmentStatus === 'COMPLETED') {
            <div class="confirm-status-icon confirm-status-icon--success" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h1 id="confirmation-title">Consulta já realizada</h1>
            <p class="confirm-lead">Este atendimento já aconteceu. Obrigado pela confiança.</p>
          } @else if (responded()) {
            <div
              class="confirm-status-icon"
              [class.confirm-status-icon--success]="data?.confirmationStatus === 'CONFIRMED'"
              [class.confirm-status-icon--declined]="data?.confirmationStatus === 'DECLINED'"
              aria-hidden="true"
            >
              @if (data?.confirmationStatus === 'CONFIRMED') {
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>
              } @else {
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m18 6-12 12M6 6l12 12"/></svg>
              }
            </div>
            <h1 id="confirmation-title">{{ data?.confirmationStatus === 'CONFIRMED' ? 'Presença confirmada' : 'Resposta registrada' }}</h1>
            <p class="confirm-lead">
              {{ data?.confirmationStatus === 'CONFIRMED'
                ? 'Tudo certo. A clínica já recebeu sua confirmação.'
                : 'A clínica foi avisada e poderá entrar em contato para reagendar.' }}
            </p>
            <div class="confirm-detail-card" aria-label="Detalhes da consulta">
              <div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>{{ dateLabel }}</span></div>
              <div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>{{ timeLabel }}</span></div>
              @if (data?.dentistName) {
                <div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>{{ data?.dentistName }}</span></div>
              }
            </div>
            <button type="button" class="confirm-change-link" (click)="reset()">Alterar resposta</button>
          } @else if (data) {
            <div class="confirm-greeting">Olá, {{ data.patientName }}</div>
            <h1 id="confirmation-title">Confirme sua consulta</h1>
            <p class="confirm-lead">Confira os dados abaixo e informe se poderá comparecer.</p>
            <div class="confirm-detail-card" aria-label="Detalhes da consulta">
              <div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>{{ dateLabel }}</span></div>
              <div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>{{ timeLabel }}</span></div>
              @if (data.dentistName) {
                <div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>{{ data.dentistName }}</span></div>
              }
            </div>
            @if (respondError) {
              <p class="confirm-error" role="alert">{{ respondError }}</p>
            }
            <div class="confirm-actions">
              <button type="button" class="confirm-btn confirm-btn--primary" [disabled]="responding" (click)="respond('CONFIRM')">
                @if (responding && pendingAction === 'CONFIRM') {
                  <span class="spinner" aria-hidden="true"></span>
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                }
                Confirmar presença
              </button>
              <button type="button" class="confirm-btn confirm-btn--secondary" [disabled]="responding" (click)="respond('DECLINE')">
                @if (responding && pendingAction === 'DECLINE') {
                  <span class="spinner spinner-dark" aria-hidden="true"></span>
                }
                Não poderei comparecer
              </button>
            </div>
          }
        </section>
      </main>

      <footer class="confirm-footer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        <span>Confirmação protegida pelo OdontoApp</span>
      </footer>
    </div>
  `,
  styleUrl: './confirm-appointment.component.css'
})
export class ConfirmAppointmentComponent implements OnInit {
  readonly defaultLogo = 'assets/logo-mark-192.png'
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

  get brandLogoUrl() {
    return this.data?.logoUrl || this.defaultLogo
  }

  get brandLogoAlt() {
    return this.data?.logoUrl && this.data?.clinicName ? `Logo da ${this.data.clinicName}` : 'Logo OdontoApp'
  }

  get accentContrast() {
    const color = this.data?.primaryColor || '#2563eb'
    const match = color.match(/^#([\da-f]{6})$/i)
    if (!match) return '#ffffff'
    const value = Number.parseInt(match[1], 16)
    const red = (value >> 16) & 255
    const green = (value >> 8) & 255
    const blue = value & 255
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
    return luminance > 0.62 ? '#0f172a' : '#ffffff'
  }

  useDefaultLogo(event: Event) {
    const image = event.target as HTMLImageElement | null
    if (!image || image.getAttribute('src') === this.defaultLogo) return
    image.src = this.defaultLogo
    image.alt = 'Logo OdontoApp'
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
