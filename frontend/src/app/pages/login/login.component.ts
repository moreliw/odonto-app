import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { RouterLink, Router } from '@angular/router'
import { AuthService } from '../../services/auth.service'

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-root">
      <aside class="auth-hero">
        <div class="auth-hero-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          Plataforma odontológica
        </div>
        <h1>Gestão inteligente<br/>para sua clínica</h1>
        <p>Controle total de pacientes, agenda, prontuários e finanças em um único lugar.</p>
        <div class="auth-features">
          <div class="auth-feature-item"><span class="auth-feature-dot"></span>Agenda online com notificações</div>
          <div class="auth-feature-item"><span class="auth-feature-dot"></span>Prontuário digital completo</div>
          <div class="auth-feature-item"><span class="auth-feature-dot"></span>Gestão financeira integrada</div>
          <div class="auth-feature-item"><span class="auth-feature-dot"></span>Múltiplas clínicas e usuários</div>
        </div>
      </aside>

      <section class="auth-panel">
        <div class="auth-panel-inner">
          <div class="auth-logo">
            <div class="auth-logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2c-2 0-4 2-4 4 0 3 1 5 2 7 .5 1 1 2 1 3h2c0-1 .5-2 1-3 1-2 2-4 2-7 0-2-2-4-4-4z"/><path d="M8.5 14C7 14.5 5 16 5 18c0 2 1.5 3 3.5 3h7c2 0 3.5-1 3.5-3 0-2-2-3.5-3.5-4"/></svg>
            </div>
            <span class="auth-logo-text">Odonto Platform</span>
          </div>

          <h2 class="auth-heading">Bem-vindo de volta</h2>
          <p class="auth-sub">Faça login para acessar o painel da sua clínica.</p>

          @if (error) {
            <div class="auth-error">{{ error }}</div>
          }

          <form class="form" (ngSubmit)="submit()" style="margin-bottom:0">
            <div class="form-group">
              <label for="identifier">Usuário ou e-mail</label>
              <div class="input-wrapper">
                <span class="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input
                  class="input"
                  id="identifier"
                  [(ngModel)]="identifier"
                  name="identifier"
                  placeholder="ex.: dr.silva ou dr@clinica.com"
                  autocomplete="username"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label for="password">Senha</label>
              <div class="input-wrapper">
                <span class="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input
                  class="input"
                  id="password"
                  [(ngModel)]="password"
                  name="password"
                  [type]="showPwd ? 'text' : 'password'"
                  placeholder="Sua senha"
                  autocomplete="current-password"
                  required
                  style="padding-right: 42px;"
                />
                <button type="button" class="input-action" (click)="showPwd = !showPwd" [attr.aria-label]="showPwd ? 'Ocultar senha' : 'Mostrar senha'">
                  @if (showPwd) {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  } @else {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            <button class="btn btn-primary btn-block" style="margin-top:6px;padding:11px;" [disabled]="loading" type="submit">
              @if (loading) { <span class="spinner"></span> Entrando... }
              @else { Entrar na conta }
            </button>
          </form>

          <div class="auth-footer-link">
            Não tem conta?
            <a routerLink="/signup">Criar clínica gratuita</a>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class LoginComponent {
  identifier = ''
  password = ''
  error = ''
  loading = false
  showPwd = false

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    this.error = ''
    this.loading = true
    this.auth.login(this.identifier.trim(), this.password).subscribe({
      next: () => { this.loading = false; this.router.navigateByUrl('/') },
      error: (err: any) => { this.loading = false; this.error = err.error?.message || 'Credenciais inválidas. Verifique e tente novamente.' },
    })
  }
}
