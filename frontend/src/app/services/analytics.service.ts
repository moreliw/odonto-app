import { Injectable, isDevMode } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { filter } from 'rxjs/operators'

/**
 * Métricas próprias do site público, sem cookies e sem dados pessoais.
 *
 * Cada evento é um beacon mínimo para `/e?t=<tipo>&...`. O nginx do container
 * responde 204 e grava só a linha da requisição num log dedicado, que o painel
 * privado (/painel/) agrega a cada 5 minutos (deploy/painel/odonto-stats.py).
 * Nada passa pelo backend e nada é gravado no banco das clínicas.
 *
 * Um id aleatório vive apenas no sessionStorage da aba, para agrupar os eventos
 * de uma mesma visita. Ele some quando a aba fecha.
 *
 * Só o site comercial é medido. As áreas autenticadas (/app e /admin) tratam
 * dados de pacientes e ficam inteiramente fora da coleta.
 *
 * Tipos de evento:
 *   pv    página vista (p caminho, tt título; na primeira: ref, utm, w, r)
 *   sec   seção da home alcançada (v id)
 *   cta   clique em "começar/testar grátis" (v local do botão)
 *   plan  interesse num plano (v código, o ciclo mensal/anual)
 *   log   clique em "Entrar"
 *   wa    clique no WhatsApp (v local)
 *   em    clique no e-mail (v local)
 *   fs    começou a preencher o cadastro
 *   lead  cadastro enviado e checkout aberto (v plano)
 *   leave tempo ativo (d, segundos) e rolagem máxima da home (sd, %)
 */

type Params = Record<string, string | number | undefined>

const ENDPOINT = '/e'

/** Ids das seções da landing, na ordem em que aparecem. */
export const HOME_SECTIONS = ['produto', 'recursos', 'clinicas', 'como-funciona', 'planos']

/** Prefixos autenticados: nunca entram nas métricas. */
const PRIVATE_PREFIXES = ['/app', '/admin']

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private started = false
  private sid = ''
  private readonly sent = new Set<string>()
  private onHome = false
  private homeScroll = 0
  private lastMid = -1

  constructor(private readonly router: Router) {}

  private isPublic(path: string) {
    return !PRIVATE_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
  }

  private safeStorage(kind: 'session' | 'local'): Storage | null {
    try {
      return kind === 'session' ? window.sessionStorage : window.localStorage
    } catch {
      return null
    }
  }

  private sessionId() {
    if (this.sid) return this.sid
    const store = this.safeStorage('session')
    this.sid = store?.getItem('oa_sid') ?? ''
    if (!this.sid) {
      this.sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
      store?.setItem('oa_sid', this.sid)
    }
    return this.sid
  }

  track(type: string, params: Params = {}) {
    if (typeof window === 'undefined') return
    // Em desenvolvimento não há nginx para receber o beacon: só registra no console.
    if (isDevMode()) {
      console.debug('[analytics]', type, params)
      return
    }

    const query = new URLSearchParams({ t: type, sid: this.sessionId() })
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value).slice(0, 120))
    }
    const url = `${ENDPOINT}?${query}`

    try {
      if (navigator.sendBeacon?.(url)) return
    } catch {
      // segue para o fetch
    }
    fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  }

  /** Envia o evento uma única vez por visita para a chave informada. */
  trackOnce(key: string, type: string, params: Params = {}) {
    if (this.sent.has(key)) return
    this.sent.add(key)
    this.track(type, params)
  }

  /**
   * Marca as seções da home cujo trecho a linha do meio da tela cruzou desde a
   * última verificação. Diferente de um IntersectionObserver, não perde seções
   * quando a rolagem pula muitos pixels de uma vez (celular lento, flick rápido).
   */
  private checkSections() {
    if (!this.onHome) return
    const mid = window.scrollY + window.innerHeight / 2
    const from = this.lastMid < 0 ? mid : Math.min(this.lastMid, mid)
    const to = Math.max(this.lastMid, mid)
    this.lastMid = mid
    for (const id of HOME_SECTIONS) {
      const el = document.getElementById(id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const top = rect.top + window.scrollY
      if (top <= to && top + rect.height >= from) this.trackOnce(`sec:${id}`, 'sec', { v: id })
    }
  }

  /**
   * Registra uma página vista. A primeira da visita também leva a origem
   * (referrer/UTM), a largura da tela e se o aparelho já esteve no site antes.
   */
  private trackPageview(path: string) {
    this.onHome = path === '/'
    const params: Params = { p: path }

    if (!this.sent.has('first-pv')) {
      this.sent.add('first-pv')
      const local = this.safeStorage('local')
      const returning = local?.getItem('oa_seen') ? 1 : 0
      local?.setItem('oa_seen', '1')
      let ref = ''
      try {
        ref = document.referrer ? new URL(document.referrer).hostname : ''
      } catch {
        ref = ''
      }
      if (ref === window.location.hostname) ref = ''
      const qs = new URL(window.location.href).searchParams
      Object.assign(params, {
        ref,
        us: qs.get('utm_source') ?? undefined,
        um: qs.get('utm_medium') ?? undefined,
        uc: qs.get('utm_campaign') ?? undefined,
        w: window.innerWidth,
        r: returning
      })
    }

    // O título da rota nova chega um instante depois da navegação.
    window.setTimeout(() => {
      this.track('pv', { ...params, tt: document.title.replace(/\s*\|\s*OdontoApp.*$/i, '') })
    }, 300)

    this.lastMid = -1
    if (this.onHome) window.setTimeout(() => this.checkSections(), 600)
  }

  private placeOf(el: Element) {
    const where = el.closest('header, footer, section, nav, [role="dialog"]')
    if (!where) return 'page'
    return where.id || where.tagName.toLowerCase()
  }

  /** Classifica um link clicado no evento correspondente (ou nenhum). */
  private classify(anchor: HTMLAnchorElement): [string, Params] | null {
    const raw = anchor.getAttribute('href') ?? ''
    const place = this.placeOf(anchor)
    if (raw.startsWith('mailto:')) return ['em', { v: place }]

    let url: URL
    try {
      url = new URL(anchor.href)
    } catch {
      return null
    }
    if (url.hostname === 'wa.me' || url.hostname.endsWith('whatsapp.com')) return ['wa', { v: place }]

    if (url.origin === window.location.origin) {
      if (url.pathname === '/signup') return ['cta', { v: place }]
      if (url.pathname === '/login') return ['log', { v: place }]
    }
    return null
  }

  /** Chamado uma única vez, do AppComponent. */
  start() {
    if (this.started || typeof window === 'undefined') return
    this.started = true

    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(event => {
      const path = (event.urlAfterRedirects || '/').split('?')[0].split('#')[0] || '/'
      if (this.isPublic(path)) this.trackPageview(path)
      else this.onHome = false
    })

    // Links: cadastro, login, WhatsApp e e-mail; mais qualquer [data-track] explícito.
    document.addEventListener(
      'click',
      event => {
        const target = event.target as Element | null
        const custom = target?.closest?.<HTMLElement>('[data-track]')
        if (custom?.dataset['track']) {
          this.track(custom.dataset['track'], { v: custom.dataset['trackValue'], o: custom.dataset['trackExtra'] })
          return
        }
        const anchor = target?.closest?.('a')
        if (!anchor) return
        const hit = this.classify(anchor as HTMLAnchorElement)
        if (hit) this.track(hit[0], hit[1])
      },
      true
    )

    // Seções alcançadas e profundidade de rolagem, no máximo uma vez por quadro.
    let frame = 0
    window.addEventListener(
      'scroll',
      () => {
        if (!this.onHome || frame) return
        frame = requestAnimationFrame(() => {
          frame = 0
          this.checkSections()
          const doc = document.documentElement
          const depth = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1)
          this.homeScroll = Math.max(this.homeScroll, Math.min(100, Math.round(depth * 100)))
        })
      },
      { passive: true }
    )

    // Tempo ativo (só com a aba visível) e rolagem da home, enviados ao sair.
    let activeMs = 0
    let visibleSince = document.visibilityState === 'visible' ? performance.now() : 0
    const flush = () => {
      if (visibleSince) {
        activeMs += performance.now() - visibleSince
        visibleSince = 0
      }
      this.track('leave', { d: Math.round(activeMs / 1000), sd: this.homeScroll })
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
      else visibleSince = performance.now()
    })
    window.addEventListener('pagehide', () => {
      if (visibleSince) flush()
    })
  }
}
