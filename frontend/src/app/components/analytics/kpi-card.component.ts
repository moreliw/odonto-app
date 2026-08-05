import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'
import { KpiMetric } from '../../models/analytics.model'

@Component({
    selector: 'app-kpi-card',
    imports: [CommonModule],
    template: `
    <article class="card kpi-card">
      <div class="kpi-card-head">
        <span class="kpi-title">{{ metric.title }}</span>
        <span class="kpi-icon" aria-hidden="true">
          @switch (metric.id) {
            @case ('patients') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
            }
            @case ('revenue') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.7-1-1.9-1.5-4-1.5-2.2 0-3.5 1-3.5 2.5 0 4 7.5 1.5 7.5 5.5 0 1.5-1.4 2.5-3.8 2.5-2 0-3.5-.6-4.2-1.7M12 5v14"/></svg>
            }
            @case ('pending') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l2.5 2.5"/><circle cx="12" cy="12" r="9"/></svg>
            }
            @case ('completed') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>
            }
            @default {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            }
          }
        </span>
      </div>
      <strong class="kpi-value">{{ metric.value }}</strong>
      @if (metric.trend) {
        <span class="kpi-delta" [class.down]="metric.trend === 'down'">
          {{ metric.trend === 'down' ? '▼' : '▲' }} {{ metric.delta }}
        </span>
      } @else {
        <span class="kpi-delta kpi-delta--plain">{{ metric.delta }}</span>
      }
    </article>
  `
})
export class KpiCardComponent {
  @Input({ required: true }) metric!: KpiMetric
}
