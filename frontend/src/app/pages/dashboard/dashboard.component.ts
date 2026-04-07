import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { combineLatest } from "rxjs";
import { AnalyticsStore } from "../../state/analytics.store";
import { KpiCardComponent } from "../../components/analytics/kpi-card.component";
import { LineChartComponent } from "../../components/analytics/line-chart.component";
import { BarChartComponent } from "../../components/analytics/bar-chart.component";
import { DonutChartComponent } from "../../components/analytics/donut-chart.component";
import { HeatmapComponent } from "../../components/analytics/heatmap.component";
import { FilterBarComponent } from "../../components/analytics/filter-bar.component";
import { AdvancedTableComponent } from "../../components/analytics/advanced-table.component";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    KpiCardComponent,
    LineChartComponent,
    BarChartComponent,
    DonutChartComponent,
    HeatmapComponent,
    FilterBarComponent,
    AdvancedTableComponent,
  ],
  template: `
    <section class="dashboard-page">
      <div class="grid cols-4 kpi-grid">
        <app-kpi-card
          *ngFor="let metric of (kpis$ | async) || []"
          [metric]="metric"
        ></app-kpi-card>
      </div>

      <div class="grid cols-2 mt-4">
        <app-line-chart [points]="(lineSeries$ | async) || []"></app-line-chart>
        <app-bar-chart [points]="(barSeries$ | async) || []"></app-bar-chart>
      </div>

      <div class="grid cols-2 mt-4">
        <app-donut-chart
          [slices]="(donutSeries$ | async) || []"
        ></app-donut-chart>
        <app-heatmap [cells]="(heatmap$ | async) || []"></app-heatmap>
      </div>

      <app-filter-bar
        class="mt-4"
        [search]="search"
        [status]="status"
        [pageSize]="pageSize"
        (searchChange)="onSearchChange($event)"
        (statusChange)="onStatusChange($event)"
        (pageSizeChange)="onPageSizeChange($event)"
      ></app-filter-bar>

      <app-advanced-table
        class="mt-4"
        [rows]="(pagedRows$ | async) || []"
        [page]="page"
        [totalPages]="(totalPages$ | async) || 1"
        [totalRows]="(filteredRows$ | async)?.length || 0"
        (prevPage)="onPrevPage()"
        (nextPage)="onNextPage()"
      ></app-advanced-table>
    </section>
  `,
})
export class DashboardComponent {
  readonly kpis$ = this.store.kpis$;
  readonly lineSeries$ = this.store.lineSeries$;
  readonly barSeries$ = this.store.barSeries$;
  readonly donutSeries$ = this.store.donutSeries$;
  readonly heatmap$ = this.store.heatmap$;
  readonly filteredRows$ = this.store.filteredRows$;
  readonly pagedRows$ = this.store.pagedRows$;
  readonly totalPages$ = this.store.totalPages$;
  search = "";
  status: "ALL" | "PAGO" | "PENDENTE" | "ATRASADO" = "ALL";
  page = 1;
  pageSize = 6;

  constructor(private readonly store: AnalyticsStore) {
    combineLatest([
      this.store.page$,
      this.store.pageSize$,
      this.store.status$,
      this.store.search$,
    ]).subscribe(([page, pageSize, status, search]) => {
      this.page = page;
      this.pageSize = pageSize;
      this.status = status;
      this.search = search;
    });
  }

  onSearchChange(value: string) {
    this.store.setSearch(value);
  }

  onStatusChange(value: "ALL" | "PAGO" | "PENDENTE" | "ATRASADO") {
    this.store.setStatus(value);
  }

  onPageSizeChange(value: number) {
    this.store.setPageSize(value);
  }

  onPrevPage() {
    this.store.setPage(this.page - 1);
  }

  onNextPage() {
    this.store.setPage(this.page + 1);
  }
}
