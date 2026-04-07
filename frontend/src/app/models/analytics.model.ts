export type TrendDirection = 'up' | 'down'

export interface KpiMetric {
  id: string
  title: string
  value: string
  delta: string
  trend: TrendDirection
}

export interface ChartPoint {
  label: string
  value: number
}

export interface DonutSlice {
  label: string
  value: number
  color: string
}

export interface HeatmapCell {
  day: string
  hour: string
  intensity: number
}

export interface RevenueRow {
  id: string
  patient: string
  procedure: string
  doctor: string
  status: 'PAGO' | 'PENDENTE' | 'ATRASADO'
  amount: number
  date: string
}
