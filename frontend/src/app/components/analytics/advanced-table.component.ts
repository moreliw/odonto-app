import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RevenueRow } from '../../models/analytics.model'

@Component({
  selector: 'app-advanced-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card table-wrapper">
      <div class="table-title-row">
        <h2>Receitas Recentes</h2>
        <span class="muted">{{totalRows}} registros</span>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Procedimento</th>
            <th>Dentista</th>
            <th>Status</th>
            <th>Data</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td>{{row.patient}}</td>
            <td>{{row.procedure}}</td>
            <td>{{row.doctor}}</td>
            <td><span class="status-chip" [class.pending]="row.status === 'PENDENTE'" [class.late]="row.status === 'ATRASADO'">{{row.status}}</span></td>
            <td>{{row.date | date:'dd/MM/yyyy'}}</td>
            <td>R$ {{row.amount | number:'1.2-2'}}</td>
          </tr>
        </tbody>
      </table>
      <div class="table-pagination">
        <button class="btn btn-outline" (click)="prevPage.emit()" [disabled]="page <= 1">Anterior</button>
        <span class="muted">Página {{page}} de {{totalPages}}</span>
        <button class="btn btn-outline" (click)="nextPage.emit()" [disabled]="page >= totalPages">Próxima</button>
      </div>
    </div>
  `
})
export class AdvancedTableComponent {
  @Input() rows: RevenueRow[] = []
  @Input() page = 1
  @Input() totalPages = 1
  @Input() totalRows = 0

  @Output() prevPage = new EventEmitter<void>()
  @Output() nextPage = new EventEmitter<void>()
}
