import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { MasterAdminService } from '../../services/master-admin.service'

@Component({
  selector: 'app-master-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="auth-layout">
      <div class="auth-card">
        <div class="auth-card-header">
          <img src="/assets/logo.svg" alt="Odonto Platform" />
          <h2>Super administrador</h2>
          <p>Controle financeiro, operacional e cadastro de empresas</p>
        </div>
        <form class="form" (ngSubmit)="submit()">
          <div>
            <label>E-mail administrativo</label>
            <input class="input" [(ngModel)]="email" name="email" type="email" required />
          </div>
          <div>
            <label>Senha</label>
            <input class="input" [(ngModel)]="password" name="password" [type]="showPassword ? 'text' : 'password'" required />
            <button class="btn btn-link mt-2" type="button" (click)="showPassword = !showPassword">{{ showPassword ? 'Ocultar senha' : 'Mostrar senha' }}</button>
          </div>
          <button class="btn btn-primary btn-block" [disabled]="loading" type="submit">{{ loading ? 'Entrando...' : 'Entrar no painel master' }}</button>
          <p *ngIf="error" class="muted mt-2" style="color: var(--danger)">{{error}}</p>
        </form>
      </div>
    </section>
  `
})
export class MasterLoginComponent {
  email = ''
  password = ''
  error = ''
  loading = false
  showPassword = false

  constructor(private readonly master: MasterAdminService, private readonly router: Router) {}

  submit() {
    this.error = ''
    this.loading = true
    this.master.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.loading = false
        this.router.navigateByUrl('/admin/dashboard')
      },
      error: err => {
        this.loading = false
        this.error = err.error?.message || 'Falha no login master'
      }
    })
  }
}
