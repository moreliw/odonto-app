import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'

@Component({
  selector: 'app-master-operations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-page">
      <div class="table-title-row">
        <div>
          <h1 style="margin:0;font-size:22px;">Operacional</h1>
          <p class="muted" style="margin:6px 0 0;">Uso agregado: pacientes, agenda, prontuários e faturas por empresa</p>
        </div>
        <button type="button" class="btn btn-outline" (click)="load()">Atualizar</button>
      </div>

      <div class="grid cols-4 mt-4" *ngIf="overview">
        <article class="card kpi-card">
          <p class="kpi-title">Pacientes</p>
          <p class="kpi-value">{{ overview.totals.patients }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Agendamentos</p>
          <p class="kpi-value">{{ overview.totals.appointments }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Usuários</p>
          <p class="kpi-value">{{ overview.totals.users }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Prontuários</p>
          <p class="kpi-value">{{ overview.totals.records }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Arquivos</p>
          <p class="kpi-value">{{ overview.totals.files }}</p>
        </article>
        <article class="card kpi-card">
          <p class="kpi-title">Faturas (qtd)</p>
          <p class="kpi-value">{{ overview.totals.invoicesCount }}</p>
        </article>
      </div>

      <section class="card mt-4">
        <h2>Por empresa</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Subdomínio</th>
              <th>Pacientes</th>
              <th>Agenda</th>
              <th>Usuários</th>
              <th>Prontuários</th>
              <th>Faturas R$</th>
              <th>Leitura</th>
              <th>Obs.</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of overview?.clinics">
              <td><strong>{{ row.name }}</strong></td>
              <td>{{ row.subdomain }}</td>
              <td>{{ row.stats?.patients ?? '—' }}</td>
              <td>{{ row.stats?.appointments ?? '—' }}</td>
              <td>{{ row.stats?.users ?? '—' }}</td>
              <td>{{ row.stats?.records ?? '—' }}</td>
              <td>{{ row.stats?.invoicesAmountSum ?? '—' }}</td>
              <td>
                <span class="status-chip late" *ngIf="row.error">Erro</span>
                <span class="status-chip" *ngIf="!row.error">OK</span>
              </td>
              <td class="muted" style="font-size:12px;max-width:240px;">{{ row.error || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  `
})
export class MasterOperationsComponent implements OnInit {
  overview: any = null

  constructor(private readonly http: HttpClient) {}

  ngOnInit() {
    this.load()
  }

  load() {
    this.http.get<any>('/api/master/operations/overview').subscribe(res => (this.overview = res))
  }
}
