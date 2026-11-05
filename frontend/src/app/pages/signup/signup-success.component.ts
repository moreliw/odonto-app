import { Component, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { AuthService } from '../../services/auth.service'
import { timeout } from 'rxjs'

type SessionStatusResponse = {
  onboardingStatus: 'PENDING' | 'PROCESSING' | 'PROVISIONED' | 'FAILED' | 'EXPIRED' | 'CANCELED'
  loginAllowed: boolean
  subdomain: string
  auth: { accessToken: string; refreshToken: string; user: { id: string; email: string; name: string; role: string } } | null
}

/**
 * Tela de transição entre o checkout e o painel — deve ficar no ar o menor
 * tempo possível. Sem jargão técnico (plano, subdomínio, status da
 * assinatura): o usuário só precisa saber que a conta está sendo criada e,
 * assim que possível, cair direto logado em /app.
 */
@Component({
    selector: 'app-signup-success',
    imports: [CommonModule, RouterLink],
    template: `
    <div class="onboard-page">
      <div class="onboard-card">
        @if (state === 'entering') {
          <div class="onboard-spinner" aria-hidden="true"></div>
          <h1>Tudo pronto!</h1>
          <p>Entrando na sua clínica...</p>
        } @else if (state === 'waiting') {
          <div class="onboard-spinner" aria-hidden="true"></div>
          <h1>Preparando sua clínica</h1>
          <p>Isso leva só alguns segundos.</p>
        } @else {
          <div class="onboard-icon onboard-icon--error" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1>Não foi possível concluir agora</h1>
          <p>{{ errorMessage }}</p>
          <div class="onboard-actions">
            <button type="button" class="btn btn-outline" (click)="retry()">Verificar novamente</button>
            <a routerLink="/login" class="btn btn-primary">Ir para login</a>
          </div>
        }
      </div>
    </div>
  `
})
export class SignupSuccessComponent implements OnInit, OnDestroy {
  state: 'waiting' | 'entering' | 'error' = 'waiting'
  errorMessage = ''
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private pollAttempts = 0
  private readonly maxAttempts = 40
  private sessionId = ''
  private destroyed = false

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly auth: AuthService
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      this.sessionId = params.get('session_id') || ''
      if (this.pollTimer) clearTimeout(this.pollTimer)
      if (!this.sessionId) {
        this.state = 'error'
        this.errorMessage = 'Não encontramos os dados do seu cadastro. Refaça o cadastro para continuar.'
        return
      }
      this.pollAttempts = 0
      this.fetchStatus()
    })
  }

  ngOnDestroy() {
    this.destroyed = true
    if (this.pollTimer) clearTimeout(this.pollTimer)
  }

  retry() {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollAttempts = 0
    this.state = 'waiting'
    this.fetchStatus()
  }

  private fetchStatus() {
    if (this.destroyed || !this.sessionId) return
    this.http.get<SessionStatusResponse>(`/api/public/billing/session/${encodeURIComponent(this.sessionId)}`).pipe(timeout(30_000)).subscribe({
      next: res => {
        if (this.destroyed) return
        if (res.onboardingStatus === 'FAILED' || res.onboardingStatus === 'EXPIRED' || res.onboardingStatus === 'CANCELED') {
          this.state = 'error'
          this.errorMessage =
            res.onboardingStatus === 'EXPIRED'
              ? 'O link do cadastro expirou. Faça o cadastro novamente.'
              : 'Não foi possível concluir este cadastro. Verifique novamente ou entre em contato com o suporte antes de iniciar outra assinatura.'
          return
        }

        if (res.loginAllowed && res.auth) {
          this.state = 'entering'
          this.auth.setSession({
            accessToken: res.auth.accessToken,
            refreshToken: res.auth.refreshToken,
            user: res.auth.user as { id: string; email: string; name: string; role: 'ADMIN' | 'USER' },
            tenant: res.subdomain
          })
          setTimeout(() => this.router.navigateByUrl('/app'), 500)
          return
        }

        if (res.loginAllowed && !res.auth) {
          // Provisionado, mas a emissão automática de token falhou (ex.: banco do
          // tenant momentaneamente indisponível). O usuário só precisa logar manualmente.
          this.router.navigateByUrl('/login')
          return
        }

        this.state = 'waiting'
        if (this.pollAttempts < this.maxAttempts) {
          this.pollAttempts += 1
          this.pollTimer = setTimeout(() => this.fetchStatus(), 2000)
        } else {
          this.state = 'error'
          this.errorMessage = 'A criação da sua clínica está demorando mais que o esperado. Tente fazer login em alguns minutos.'
        }
      },
      error: err => {
        if (this.destroyed) return
        if (err?.status !== 404 && this.pollAttempts < this.maxAttempts) {
          this.pollAttempts += 1
          this.pollTimer = setTimeout(() => this.fetchStatus(), 3000)
          return
        }
        this.state = 'error'
        this.errorMessage = 'Não foi possível confirmar seu cadastro agora. Verifique novamente; você não precisa iniciar outro pagamento.'
      }
    })
  }
}
