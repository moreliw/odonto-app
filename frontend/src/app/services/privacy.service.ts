import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'

const STORAGE_KEY = 'hideMoneyValues'

/** Esconde valores em dinheiro na tela (útil em atendimento/tela compartilhada). Persiste entre sessões. */
@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private readonly hidden$ = new BehaviorSubject<boolean>(
    typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true'
  )
  readonly hidden = this.hidden$.asObservable()

  get isHidden() {
    return this.hidden$.value
  }

  toggle() {
    const next = !this.hidden$.value
    this.hidden$.next(next)
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, String(next))
  }
}
