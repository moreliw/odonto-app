import { Injectable, signal } from '@angular/core'

export type ToastType = 'success' | 'error' | 'warning' | 'info'
export interface Toast { id: number; type: ToastType; title: string; message?: string }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _id = 0
  readonly toasts = signal<Toast[]>([])

  show(title: string, type: ToastType = 'info', message?: string, duration = 4000) {
    const id = ++this._id
    this.toasts.update(t => [...t, { id, type, title, message }])
    setTimeout(() => this.dismiss(id), duration)
  }

  success(title: string, message?: string) { this.show(title, 'success', message) }
  error(title: string, message?: string) { this.show(title, 'error', message) }
  warning(title: string, message?: string) { this.show(title, 'warning', message) }
  info(title: string, message?: string) { this.show(title, 'info', message) }

  dismiss(id: number) { this.toasts.update(t => t.filter(x => x.id !== id)) }
}
