import { Injectable } from '@angular/core'
import { BehaviorSubject, combineLatest, map } from 'rxjs'
import { AnalyticsDataService } from '../services/analytics-data.service'
import { RevenueRow } from '../models/analytics.model'

@Injectable({ providedIn: 'root' })
export class AnalyticsStore {
  private readonly searchSubject = new BehaviorSubject<string>('')
  private readonly statusSubject = new BehaviorSubject<'ALL' | RevenueRow['status']>('ALL')
  private readonly pageSubject = new BehaviorSubject<number>(1)
  private readonly pageSizeSubject = new BehaviorSubject<number>(6)

  readonly search$ = this.searchSubject.asObservable()
  readonly status$ = this.statusSubject.asObservable()
  readonly page$ = this.pageSubject.asObservable()
  readonly pageSize$ = this.pageSizeSubject.asObservable()

  readonly kpis$ = this.data.getKpis()
  readonly lineSeries$ = this.data.getLineSeries()
  readonly barSeries$ = this.data.getBarSeries()
  readonly donutSeries$ = this.data.getDonutSeries()
  readonly heatmap$ = this.data.getHeatmap()
  readonly rows$ = this.data.getRevenueRows()

  readonly filteredRows$ = combineLatest([this.rows$, this.search$, this.status$]).pipe(
    map(([rows, search, status]) => {
      const normalizedSearch = search.trim().toLowerCase()
      return rows.filter(row => {
        const matchesStatus = status === 'ALL' || row.status === status
        const matchesSearch =
          !normalizedSearch ||
          row.patient.toLowerCase().includes(normalizedSearch) ||
          row.procedure.toLowerCase().includes(normalizedSearch) ||
          row.doctor.toLowerCase().includes(normalizedSearch)
        return matchesStatus && matchesSearch
      })
    })
  )

  readonly pagedRows$ = combineLatest([this.filteredRows$, this.page$, this.pageSize$]).pipe(
    map(([rows, page, pageSize]) => {
      const start = (page - 1) * pageSize
      return rows.slice(start, start + pageSize)
    })
  )

  readonly totalPages$ = combineLatest([this.filteredRows$, this.pageSize$]).pipe(
    map(([rows, pageSize]) => Math.max(1, Math.ceil(rows.length / pageSize)))
  )

  constructor(private readonly data: AnalyticsDataService) {}

  setSearch(value: string) {
    this.searchSubject.next(value)
    this.pageSubject.next(1)
  }

  setStatus(value: 'ALL' | RevenueRow['status']) {
    this.statusSubject.next(value)
    this.pageSubject.next(1)
  }

  setPage(value: number) {
    this.pageSubject.next(Math.max(1, value))
  }

  setPageSize(value: number) {
    this.pageSizeSubject.next(value)
    this.pageSubject.next(1)
  }
}
