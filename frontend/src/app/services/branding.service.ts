import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { BehaviorSubject, catchError, of, tap } from 'rxjs'

export type Branding = { name: string | null; primaryColor: string | null; logoUrl: string | null }

const DEFAULT_PRIMARY = '#2563eb'

function clamp(n: number) {
  return Math.min(255, Math.max(0, n))
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const int = parseInt(m[1], 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => clamp(Math.round(n)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Mistura a cor com branco (amount>0) ou preto (amount<0) para gerar tons claros/escuros. */
function shade(hex: string, amount: number) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const mix = amount > 0 ? 255 : 0
  const t = Math.abs(amount)
  return rgbToHex(rgb.r + (mix - rgb.r) * t, rgb.g + (mix - rgb.g) * t, rgb.b + (mix - rgb.b) * t)
}

/** Aplica a identidade visual (cor e logo) da clínica após o login. Sem tenant conhecido, mantém o azul padrão do produto. */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  readonly branding$ = new BehaviorSubject<Branding>({ name: null, primaryColor: null, logoUrl: null })

  constructor(private readonly http: HttpClient) {}

  load() {
    return this.http.get<Branding>('/api/public/branding').pipe(
      tap(res => {
        this.branding$.next(res)
        this.apply(res)
      }),
      catchError(() => of(this.branding$.value))
    )
  }

  get current() {
    return this.branding$.value
  }

  private apply(branding: Branding) {
    if (typeof document === 'undefined') return
    const hex = branding.primaryColor && hexToRgb(branding.primaryColor) ? branding.primaryColor : DEFAULT_PRIMARY
    const root = document.documentElement.style
    root.setProperty('--primary', hex)
    root.setProperty('--primary-600', shade(hex, -0.15))
    root.setProperty('--primary-700', shade(hex, -0.3))
    root.setProperty('--primary-50', shade(hex, 0.94))
    root.setProperty('--primary-100', shade(hex, 0.86))
  }

  reset() {
    if (typeof document === 'undefined') return
    const root = document.documentElement.style
    for (const prop of ['--primary', '--primary-600', '--primary-700', '--primary-50', '--primary-100']) {
      root.removeProperty(prop)
    }
    this.branding$.next({ name: null, primaryColor: null, logoUrl: null })
  }
}
