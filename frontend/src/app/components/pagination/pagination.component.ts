import { Component, EventEmitter, Input, Output } from '@angular/core'

@Component({
  selector: 'app-pagination',
  template: `
    @if (totalPages > 1) {
      <nav class="pagination" aria-label="Paginação de resultados">
        <span class="pagination-summary">{{ firstItem }}–{{ lastItem }} de {{ totalItems }}</span>
        <div class="pagination-controls">
          <button type="button" class="pagination-arrow" [disabled]="page <= 1" (click)="go(page - 1)" aria-label="Página anterior">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          @for (item of visiblePages; track item) {
            <button
              type="button"
              class="pagination-page"
              [class.active]="item === page"
              [attr.aria-current]="item === page ? 'page' : null"
              [attr.aria-label]="'Página ' + item"
              (click)="go(item)"
            >{{ item }}</button>
          }
          <button type="button" class="pagination-arrow" [disabled]="page >= totalPages" (click)="go(page + 1)" aria-label="Próxima página">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </nav>
    }
  `,
  styles: [`
    :host { display: block; }
    .pagination { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 16px; border-top: 1px solid var(--border); background: var(--surface); }
    .pagination-summary { color: var(--muted); font-size: 12px; white-space: nowrap; }
    .pagination-controls { display: flex; align-items: center; gap: 5px; }
    button { width: 34px; height: 34px; display: grid; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease; }
    button:hover:not(:disabled):not(.active) { background: var(--surface-2); border-color: #cbd5e1; }
    button:focus-visible { outline: 3px solid var(--primary-100); outline-offset: 2px; }
    button.active { color: #fff; border-color: var(--primary); background: var(--primary); }
    button:disabled { opacity: .42; cursor: not-allowed; }
    @media (max-width: 520px) {
      .pagination { flex-direction: column; align-items: stretch; padding: 12px; }
      .pagination-summary { text-align: center; }
      .pagination-controls { justify-content: center; }
    }
  `]
})
export class PaginationComponent {
  @Input() page = 1
  @Input() pageSize = 15
  @Input() totalItems = 0
  @Output() pageChange = new EventEmitter<number>()

  get totalPages() {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize))
  }

  get firstItem() {
    return this.totalItems ? (this.page - 1) * this.pageSize + 1 : 0
  }

  get lastItem() {
    return Math.min(this.page * this.pageSize, this.totalItems)
  }

  get visiblePages() {
    const start = Math.max(1, Math.min(this.page - 2, this.totalPages - 4))
    const end = Math.min(this.totalPages, start + 4)
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  }

  go(next: number) {
    const normalized = Math.max(1, Math.min(next, this.totalPages))
    if (normalized !== this.page) this.pageChange.emit(normalized)
  }
}

