import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="grid cols-2">
      <div class="card">
        <h2>Novo paciente</h2>
        <form class="form" (ngSubmit)="create()">
          <input class="input" [(ngModel)]="name" name="name" placeholder="Nome completo" />
          <input class="input" [(ngModel)]="email" name="email" placeholder="Email" />
          <button class="btn btn-primary" type="submit">Cadastrar</button>
        </form>
      </div>
      <div class="card">
        <h2>Lista</h2>
        <table class="table">
          <thead><tr><th>Nome</th><th>Email</th></tr></thead>
          <tbody>
            <tr *ngFor="let p of patients"><td>{{p.name}}</td><td>{{p.email}}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class PatientsComponent implements OnInit {
  patients: any[] = []
  name = ''
  email = ''
  constructor(private http: HttpClient) {}
  ngOnInit() {
    this.load()
  }
  load() {
    this.http.get<any[]>(`/api/patients`).subscribe(res => (this.patients = res))
  }
  create() {
    this.http.post(`/api/patients`, { name: this.name, email: this.email }).subscribe(() => {
      this.name = ''
      this.email = ''
      this.load()
    })
  }
}
