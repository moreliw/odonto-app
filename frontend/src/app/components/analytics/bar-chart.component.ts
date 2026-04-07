import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js'
import { ChartPoint } from '../../models/analytics.model'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card chart-card">
      <div class="chart-title-row">
        <h2>Procedimentos por categoria</h2>
        <span class="muted">Volume mensal</span>
      </div>
      <canvas #canvas></canvas>
    </article>
  `
})
export class BarChartComponent implements AfterViewInit, OnChanges {
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
      type: 'bar',
      data: {
        labels: this.points.map(point => point.label),
        datasets: [{ data: this.points.map(point => point.value), backgroundColor: '#22c55e', borderRadius: 10 }]
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
