import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'
import { KpiMetric } from '../../models/analytics.model'

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card kpi-card">
      <span class="kpi-title">{{ metric.title }}</span>
      <strong class="kpi-value">{{ metric.value }}</strong>
      <span class="kpi-delta" [class.down]="metric.trend === 'down'">
        {{ metric.trend === 'down' ? '▼' : '▲' }} {{ metric.delta }}
      </span>
    </article>
  `
})
export class KpiCardComponent {
  @Input({ required: true }) metric!: KpiMetric
}
