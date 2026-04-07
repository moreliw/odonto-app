import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="grid cols-2">
      <div class="card">
        <h2>Nova consulta</h2>
        <form class="form" (ngSubmit)="create()">
          <input class="input" [(ngModel)]="patientId" name="patientId" placeholder="ID do paciente" />
          <div class="grid cols-2">
            <input class="input" [(ngModel)]="startTime" name="startTime" type="datetime-local" />
            <input class="input" [(ngModel)]="endTime" name="endTime" type="datetime-local" />
          </div>
          <select class="select" [(ngModel)]="status" name="status">
            <option [value]="'SCHEDULED'">Agendado</option>
            <option [value]="'COMPLETED'">Concluído</option>
            <option [value]="'CANCELLED'">Cancelado</option>
          </select>
          <button class="btn btn-primary" type="submit">Agendar</button>
        </form>
      </div>
      <div class="card">
        <h2>Agenda</h2>
        <table class="table">
          <thead><tr><th>Paciente</th><th>Início</th><th>Status</th></tr></thead>
          <tbody>
            <tr *ngFor="let a of appointments"><td>{{a.patient?.name}}</td><td>{{a.startTime | date:'short'}}</td><td>{{a.status}}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class AppointmentsComponent implements OnInit {
  appointments: any[] = []
  patientId = ''
  startTime = ''
  endTime = ''
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' = 'SCHEDULED'
  constructor(private http: HttpClient) {}
  ngOnInit() {
    this.load()
  }
  load() {
    this.http.get<any[]>(`/api/appointments`).subscribe(res => (this.appointments = res))
  }
  create() {
    this.http
      .post(`/api/appointments`, { patientId: this.patientId, startTime: this.startTime, endTime: this.endTime, status: this.status })
      .subscribe(() => {
        this.patientId = ''
        this.startTime = ''
        this.endTime = ''
        this.status = 'SCHEDULED'
        this.load()
      })
  }
}
