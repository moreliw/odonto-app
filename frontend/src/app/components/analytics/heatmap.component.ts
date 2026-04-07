import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HeatmapCell } from '../../models/analytics.model'

@Component({
  selector: 'app-heatmap',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card chart-card">
      <div class="chart-title-row">
        <h2>Heatmap de ocupação</h2>
        <span class="muted">Agenda por dia e horário</span>
      </div>
      <div class="heatmap-grid">
        <div *ngFor="let cell of cells" class="heatmap-cell" [style.background]="background(cell.intensity)">
          <small>{{cell.day}}</small>
          <strong>{{cell.hour}}</strong>
        </div>
      </div>
    </article>
  `
})
export class HeatmapComponent {
  @Input() cells: HeatmapCell[] = []

  background(intensity: number) {
    return `rgba(34, 197, 94, ${Math.max(0.08, intensity)})`
  }
}
