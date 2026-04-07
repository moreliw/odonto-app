import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService } from '../../services/auth.service'

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="auth-layout">
      <div class="auth-hero">
        <img src="/assets/logo.svg" alt="Odonto" height="30" />
        <h1>Odonto Platform</h1>
        <p>Agenda inteligente, prontuário digital e controle financeiro em uma única experiência.</p>
        <div class="auth-hero-metrics">
          <div class="auth-metric">
            <span>+35%</span>
            <small>Produtividade da clínica</small>
          </div>
          <div class="auth-metric">
            <span>24/7</span>
            <small>Acesso seguro aos dados</small>
          </div>
        </div>
      </div>
      <div class="auth-card">
        <h2>Entrar na conta</h2>
        <p class="muted">Use seu nome de usuário ou e-mail para acessar</p>
        <form class="form mt-4" (ngSubmit)="submit()">
          <div>
            <label>Usuário ou e-mail</label>
            <input class="input" [(ngModel)]="identifier" name="identifier" placeholder="ex.: dr.leonardo ou contato@clinica.com" required />
          </div>
          <div>
            <label>Senha</label>
            <input class="input" [(ngModel)]="password" name="password" [type]="showPassword ? 'text' : 'password'" required />
            <button class="btn btn-link mt-2" type="button" (click)="togglePassword()">{{showPassword ? 'Ocultar senha' : 'Mostrar senha'}}</button>
          </div>
          <button class="btn btn-primary btn-block" [disabled]="loading" type="submit">{{loading ? 'Entrando...' : 'Entrar com segurança'}}</button>
          <p class="muted">Ainda não tem conta? <a routerLink="/signup">Crie sua clínica</a></p>
        </form>
        <p *ngIf="error" class="mt-2" style="color: var(--danger)">{{error}}</p>
      </div>
    </section>
  `
})
export class LoginComponent {
  identifier = ''
  password = ''
  error = ''
  loading = false
  showPassword = false
  constructor(private auth: AuthService, private router: Router) {}
  togglePassword() {
    this.showPassword = !this.showPassword
  }
  submit() {
    this.error = ''
    this.loading = true
    const identifier = this.identifier.trim()
    this.auth.login(identifier, this.password).subscribe({
      next: () => {
        this.loading = false
        this.router.navigateByUrl('/')
      },
      error: err => {
        this.loading = false
        this.error = err.error?.message || 'Credenciais inválidas'
      }
    })
  }
}
