import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ArcElement, Chart, DoughnutController, Tooltip } from 'chart.js'
import { DonutSlice } from '../../models/analytics.model'

Chart.register(DoughnutController, ArcElement, Tooltip)

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card chart-card donut-wrap">
      <div class="chart-title-row">
        <h2>Status financeiro</h2>
        <span class="muted">Distribuição atual</span>
      </div>
      <canvas #canvas></canvas>
      <div class="donut-legend">
        <div *ngFor="let item of slices" class="legend-item">
          <span class="legend-dot" [style.background]="item.color"></span>
          <span>{{item.label}}</span>
          <strong>{{item.value}}%</strong>
        </div>
      </div>
    </article>
  `
})
export class DonutChartComponent implements AfterViewInit, OnChanges {
  @Input() slices: DonutSlice[] = []
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>
  private chart: Chart | null = null

  ngAfterViewInit() {
    this.renderChart()
  }

  ngOnChanges() {
    this.renderChart()
  }

  private renderChart() {
    const canvas = this.canvasRef?.nativeElement
    if (!canvas || !this.slices.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (this.chart) this.chart.destroy()
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.slices.map(slice => slice.label),
        datasets: [{ data: this.slices.map(slice => slice.value), backgroundColor: this.slices.map(slice => slice.color), borderWidth: 0 }]
      },
      options: {
        plugins: { legend: { display: false } },
        cutout: '70%'
      }
    })
  }
}
