import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Chart, CategoryScale, Filler, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js'
import { ChartPoint } from '../../models/analytics.model'

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler)

@Component({
    selector: 'app-line-chart',
    imports: [CommonModule],
    template: `
    <article class="card chart-card">
      <div class="chart-title-row">
        <h2>{{ title }}</h2>
        <span class="muted">{{ subtitle }}</span>
      </div>
      <canvas #canvas></canvas>
    </article>
  `,
    styles: [':host { display: block; height: 100%; min-width: 0; }']
})
export class LineChartComponent implements AfterViewInit, OnChanges {
  @Input() points: ChartPoint[] = []
  @Input() title = 'Tendência'
  @Input() subtitle = ''
  @Input() color = '#2563eb'
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
            borderColor: this.color,
            backgroundColor: this.hexToRgba(this.color, 0.12),
            pointBackgroundColor: this.color,
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#ecf2ff' }, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    })
  }

  private hexToRgba(hex: string, alpha: number) {
    const m = hex.replace('#', '')
    const r = parseInt(m.substring(0, 2), 16)
    const g = parseInt(m.substring(2, 4), 16)
    const b = parseInt(m.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
}
