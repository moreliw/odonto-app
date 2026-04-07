import { Injectable } from '@angular/core'
import { Observable, of } from 'rxjs'
import { ChartPoint, DonutSlice, HeatmapCell, KpiMetric, RevenueRow } from '../models/analytics.model'

@Injectable({ providedIn: 'root' })
export class AnalyticsDataService {
  getKpis(): Observable<KpiMetric[]> {
    return of([
      { id: 'receita', title: 'Receita Total', value: 'R$ 98.450', delta: '+12,4%', trend: 'up' },
      { id: 'consultas', title: 'Consultas no Mês', value: '1.284', delta: '+8,1%', trend: 'up' },
      { id: 'ticket', title: 'Ticket Médio', value: 'R$ 386', delta: '-2,3%', trend: 'down' },
      { id: 'conversao', title: 'Conversão', value: '78,9%', delta: '+5,9%', trend: 'up' }
    ])
  }

  getLineSeries(): Observable<ChartPoint[]> {
    return of([
      { label: 'Jan', value: 58 },
      { label: 'Fev', value: 62 },
      { label: 'Mar', value: 70 },
      { label: 'Abr', value: 68 },
      { label: 'Mai', value: 77 },
      { label: 'Jun', value: 86 },
      { label: 'Jul', value: 92 }
    ])
  }

  getBarSeries(): Observable<ChartPoint[]> {
    return of([
      { label: 'Ortodontia', value: 38 },
      { label: 'Implantes', value: 52 },
      { label: 'Limpeza', value: 87 },
      { label: 'Canal', value: 21 },
      { label: 'Estética', value: 43 }
    ])
  }

  getDonutSeries(): Observable<DonutSlice[]> {
    return of([
      { label: 'Pago', value: 72, color: '#22c55e' },
      { label: 'Pendente', value: 20, color: '#f59e0b' },
      { label: 'Atrasado', value: 8, color: '#ef4444' }
    ])
  }

  getHeatmap(): Observable<HeatmapCell[]> {
    const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const hours = ['08h', '10h', '12h', '14h', '16h', '18h']
    const cells: HeatmapCell[] = []
    days.forEach((day, dayIndex) => {
      hours.forEach((hour, hourIndex) => {
        const intensity = Math.min(1, ((dayIndex + 1) * (hourIndex + 2)) / 12)
        cells.push({ day, hour, intensity })
      })
    })
    return of(cells)
  }

  getRevenueRows(): Observable<RevenueRow[]> {
    return of([
      { id: '1', patient: 'Bruno Fay', procedure: 'Implante unitário', doctor: 'Dr. Leonardo', status: 'PAGO', amount: 1800, date: '2026-04-02' },
      { id: '2', patient: 'Josiane França', procedure: 'Limpeza e profilaxia', doctor: 'Dra. Marina', status: 'PENDENTE', amount: 350, date: '2026-04-03' },
      { id: '3', patient: 'Ingrid Nascimento', procedure: 'Clareamento', doctor: 'Dr. André', status: 'PAGO', amount: 920, date: '2026-04-03' },
      { id: '4', patient: 'Patrícia Mattos', procedure: 'Canal molar', doctor: 'Dr. Leonardo', status: 'ATRASADO', amount: 1250, date: '2026-04-04' },
      { id: '5', patient: 'Gustavo Teixeira', procedure: 'Facetas', doctor: 'Dr. André', status: 'PAGO', amount: 4300, date: '2026-04-04' },
      { id: '6', patient: 'Joana Souza', procedure: 'Avaliação clínica', doctor: 'Dra. Marina', status: 'PENDENTE', amount: 220, date: '2026-04-05' },
      { id: '7', patient: 'Carlos Vieira', procedure: 'Ortodontia mensal', doctor: 'Dra. Marina', status: 'PAGO', amount: 460, date: '2026-04-05' },
      { id: '8', patient: 'Leandro Castro', procedure: 'Planejamento estético', doctor: 'Dr. André', status: 'PAGO', amount: 760, date: '2026-04-06' },
      { id: '9', patient: 'Ana Lúcia', procedure: 'Restauração', doctor: 'Dr. Leonardo', status: 'ATRASADO', amount: 540, date: '2026-04-06' },
      { id: '10', patient: 'José Silva', procedure: 'Exodontia', doctor: 'Dr. Leonardo', status: 'PENDENTE', amount: 680, date: '2026-04-06' },
      { id: '11', patient: 'Marília Weber', procedure: 'Consulta retorno', doctor: 'Dra. Marina', status: 'PAGO', amount: 190, date: '2026-04-07' },
      { id: '12', patient: 'Paulo Mendes', procedure: 'Prótese parcial', doctor: 'Dr. André', status: 'PAGO', amount: 2500, date: '2026-04-07' }
    ])
  }
}
