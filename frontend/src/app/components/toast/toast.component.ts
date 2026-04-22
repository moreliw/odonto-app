import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ToastService } from '../../services/toast.service'

const ICONS: Record<string, string> = {
  success: `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error:   `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  warning: `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 4v3M6 8.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  info:    `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 5v4M6 3.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
}

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (t of svc.toasts(); track t.id) {
        <div class="toast toast-{{t.type}}" (click)="svc.dismiss(t.id)" role="alert">
          <span class="toast-icon" [innerHTML]="icon(t.type)"></span>
          <div class="toast-body">
            <strong>{{ t.title }}</strong>
            @if (t.message) { <span>{{ t.message }}</span> }
          </div>
          <button style="background:none;border:none;cursor:pointer;color:var(--muted-light);padding:2px;display:flex;align-items:center;" aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 3L3 11M3 3l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      }
    </div>
  `
})
export class ToastsComponent {
  svc = inject(ToastService)
  icon(type: string) { return ICONS[type] ?? ICONS['info'] }
}
