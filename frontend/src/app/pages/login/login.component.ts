import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { AuthService } from '../../services/auth.service'

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="login-page">
      <section class="login-showcase" aria-label="OdontoApp">
        <div class="login-showcase-grid" aria-hidden="true"></div>

        <a class="login-brand login-brand--light" routerLink="/" aria-label="OdontoApp — ir para a página inicial">
          <span class="login-brand-icon">
            <img src="assets/logo-mark-96.png" width="46" height="46" alt="" />
          </span>
          <span class="login-brand-name">Odonto<span>App</span></span>
        </a>

        <div class="login-showcase-content">
          <h1>
            Sua clínica organizada.<br />
            <span>Seu cuidado em primeiro lugar.</span>
          </h1>
          <p>
            Centralize sua rotina em uma plataforma feita para aproximar equipe,
            pacientes e gestão.
          </p>
        </div>
      </section>

      <section class="login-access" aria-labelledby="login-title">
        <div class="login-access-top">
          <a routerLink="/" class="login-back-link">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Voltar ao site
          </a>
        </div>

        <div class="login-access-inner">
          <a class="login-brand login-brand--mobile" routerLink="/" aria-label="OdontoApp — ir para a página inicial">
            <span class="login-brand-icon">
              <img src="assets/logo-mark-96.png" width="44" height="44" alt="" />
            </span>
            <span class="login-brand-name">Odonto<span>App</span></span>
          </a>

          <div class="login-card">
            <header class="login-card-header">
              <span class="login-card-eyebrow">Área da clínica</span>
              <h2 id="login-title">Bem-vindo de volta</h2>
            </header>

            @if (error) {
              <div class="login-error" role="alert" aria-live="polite">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" />
                </svg>
                <span>{{ error }}</span>
              </div>
            }

            <form class="login-form" (ngSubmit)="submit()">
              <div class="login-field">
                <label for="identifier">E-mail ou usuário</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>
                  <input
                    id="identifier"
                    [(ngModel)]="identifier"
                    name="identifier"
                    type="text"
                    placeholder="seu@email.com"
                    autocomplete="username"
                    autocapitalize="none"
                    spellcheck="false"
                    required
                  />
                </div>
              </div>

              <div class="login-field">
                <label for="password">Senha</label>
                <div class="login-input-wrap">
                  <svg class="login-input-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    id="password"
                    [(ngModel)]="password"
                    name="password"
                    [type]="showPwd ? 'text' : 'password'"
                    placeholder="Digite sua senha"
                    autocomplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    class="login-password-action"
                    (click)="showPwd = !showPwd"
                    [attr.aria-label]="showPwd ? 'Ocultar senha' : 'Mostrar senha'"
                    [attr.aria-pressed]="showPwd"
                  >
                    @if (showPwd) {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M1 1l22 22" />
                      </svg>
                    } @else {
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    }
                  </button>
                </div>
              </div>

              <button class="login-submit" [disabled]="loading" type="submit">
                @if (loading) {
                  <span class="login-spinner" aria-hidden="true"></span>
                  Entrando com segurança...
                } @else {
                  <span>Entrar no OdontoApp</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                }
              </button>
            </form>
          </div>

          <div class="login-signup">
            <div>
              <strong>Ainda não usa o OdontoApp?</strong>
              <span>Conheça uma gestão mais simples.</span>
            </div>
            <a routerLink="/signup">
              Criar minha clínica
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </main>
  `,
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  identifier = ''
  password = ''
  error = ''
  loading = false
  showPwd = false

  constructor(private readonly auth: AuthService, private readonly router: Router) {}

  ngOnInit() {
    if (typeof sessionStorage === 'undefined') return
    const blocked = sessionStorage.getItem('authBlockedMessage')
    if (blocked) {
      this.error = blocked
      sessionStorage.removeItem('authBlockedMessage')
    }
  }

  submit() {
    if (this.loading) return
    this.error = ''
    this.loading = true
    this.auth.login(this.identifier.trim(), this.password).subscribe({
      next: () => {
        this.loading = false
        this.router.navigateByUrl('/app')
      },
      error: (err: any) => {
        this.loading = false
        const msg = err.error?.message
        const text = Array.isArray(msg) ? msg.join(' ') : msg
        this.error = text || 'Não foi possível entrar. Confira seus dados e tente novamente.'
      }
    })
  }
}
