import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Chart, CategoryScale, Filler, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js'
import { ChartPoint } from '../../models/analytics.model'

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler)

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card chart-card">
      <div class="chart-title-row">
        <h2>Tendência de receita</h2>
        <span class="muted">Últimos 7 meses</span>
      </div>
      <canvas #canvas></canvas>
    </article>
  `
})
export class LineChartComponent implements AfterViewInit, OnChanges {
  @Input() points: ChartPoint[] = []
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
    if (!canvas || !this.points.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (this.chart) this.chart.destroy()
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.points.map(point => point.label),
        datasets: [
          {
            data: this.points.map(point => point.value),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            pointBackgroundColor: '#22c55e',
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#ecf2ff' }, beginAtZero: true }
        }
      }
    })
  }
}
