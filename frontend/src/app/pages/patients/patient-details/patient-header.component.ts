import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { PatientAppointment, PatientProfile } from './patient-details.models'

@Component({
  selector: 'app-patient-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="patient-hero">
      <div class="patient-identity">
        @if (patient.photoUrl) {
          <img class="patient-photo" [src]="patient.photoUrl" [alt]="'Foto de ' + patient.name">
        } @else {
          <div class="patient-photo patient-initials" aria-hidden="true">{{ initials }}</div>
        }
        <div class="patient-identity-copy">
          <span class="patient-kicker">Ficha do paciente</span>
          <h1>{{ patient.name }}</h1>
          <p>
            <span>ID #{{ shortId }}</span>
            @if (patient.phone) { <span>{{ patient.phone }}</span> }
            @if (patient.email) { <span>{{ patient.email }}</span> }
          </p>
        </div>
      </div>
      <div class="patient-facts">
        <div><span>Idade</span><strong>{{ age !== null ? age + ' anos' : '—' }}</strong></div>
        <div><span>Nascimento</span><strong>{{ patient.birthDate ? (patient.birthDate | date:'dd/MM/yyyy') : '—' }}</strong></div>
        <div><span>Última consulta</span><strong>{{ lastAppointment ? (lastAppointment.startTime | date:'dd/MM/yyyy') : '—' }}</strong></div>
        <div><span>Próxima consulta</span><strong [class.fact-primary]="nextAppointment">{{ nextAppointment ? (nextAppointment.startTime | date:'dd/MM/yyyy') : 'Não agendada' }}</strong></div>
        <div><span>Convênio</span><strong>{{ patient.insuranceName || 'Particular' }}</strong></div>
        <div><span>Tipo sanguíneo</span><strong>{{ patient.bloodType || '—' }}</strong></div>
      </div>
      <div class="patient-actions">
        @if (canEdit) { <button type="button" class="btn btn-primary" (click)="edit.emit()">Editar paciente</button> }
        <button type="button" class="btn btn-icon" aria-label="Mais ações" title="Mais ações">•••</button>
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .patient-hero { display:grid; grid-template-columns:minmax(300px,1.25fr) minmax(480px,1.5fr) auto; align-items:center; gap:24px; padding:22px 24px; border:1px solid var(--border); border-radius:16px; background:var(--surface); box-shadow:var(--shadow-sm); }
    .patient-identity { min-width:0; display:flex; align-items:center; gap:14px; }
    .patient-photo { width:58px; height:58px; flex:0 0 58px; border-radius:16px; object-fit:cover; }
    .patient-initials { display:grid; place-items:center; color:#fff; background:linear-gradient(145deg,var(--primary),#4d8cff); font-size:19px; font-weight:800; }
    .patient-identity-copy { min-width:0; }
    .patient-kicker { color:var(--primary); font-size:10px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
    h1 { overflow:hidden; margin:3px 0 5px; color:var(--text); font-size:22px; line-height:1.15; text-overflow:ellipsis; white-space:nowrap; }
    .patient-identity p { display:flex; flex-wrap:wrap; gap:5px 14px; margin:0; color:var(--muted); font-size:11px; }
    .patient-identity p span:not(:first-child)::before { content:'•'; margin-right:14px; color:var(--border-strong); }
    .patient-facts { display:grid; grid-template-columns:repeat(3,minmax(100px,1fr)); gap:16px 20px; }
    .patient-facts div { min-width:0; }
    .patient-facts span { display:block; margin-bottom:4px; color:var(--muted); font-size:10px; }
    .patient-facts strong { display:block; overflow:hidden; color:var(--text); font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
    .patient-facts .fact-primary { color:var(--primary); }
    .patient-actions { display:flex; align-items:center; gap:8px; }
    @media (max-width:1180px) { .patient-hero { grid-template-columns:1fr auto; } .patient-facts { grid-column:1/-1; grid-row:2; } .patient-actions { grid-column:2; grid-row:1; } }
    @media (max-width:720px) { .patient-hero { grid-template-columns:1fr; padding:18px; } .patient-facts { grid-column:1; grid-template-columns:repeat(2,1fr); } .patient-actions { grid-column:1; grid-row:auto; } .patient-actions .btn-primary { flex:1; } .patient-identity p { display:grid; gap:2px; } .patient-identity p span::before { display:none; } }
  `]
})
export class PatientHeaderComponent {
  @Input({ required: true }) patient!: PatientProfile
  @Input() appointments: PatientAppointment[] = []
  @Input() canEdit = true
  @Output() edit = new EventEmitter<void>()

  get initials() { return this.patient.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() }
  get shortId() { return this.patient.id.split('-')[0].toUpperCase() }
  get age() {
    if (!this.patient.birthDate) return null
    const birth = new Date(this.patient.birthDate)
    const today = new Date()
    let value = today.getFullYear() - birth.getFullYear()
    if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) value--
    return value
  }
  get nextAppointment() {
    const now = Date.now()
    return [...this.appointments].filter(item => item.status === 'SCHEDULED' && new Date(item.startTime).getTime() >= now).sort((a,b) => +new Date(a.startTime) - +new Date(b.startTime))[0]
  }
  get lastAppointment() {
    const now = Date.now()
    return [...this.appointments].filter(item => new Date(item.startTime).getTime() < now || item.status === 'COMPLETED').sort((a,b) => +new Date(b.startTime) - +new Date(a.startTime))[0]
  }
}
