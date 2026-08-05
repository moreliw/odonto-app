export type TrendDirection = 'up' | 'down'

export interface KpiMetric {
  id: string
  title: string
  value: string
  /** Legenda curta abaixo do valor. Sem `trend`, é exibida sem seta de comparação — use quando não há um período anterior real para comparar. */
  delta: string
  trend?: TrendDirection
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
