import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { MasterAdminService } from '../../services/master-admin.service'

@Component({
  selector: 'app-master-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div style="min-height:100vh;background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%);display:flex;align-items:center;justify-content:center;padding:24px;">
      <div style="width:100%;max-width:400px;">
        <div style="text-align:center;margin-bottom:40px;">
          <div style="width:52px;height:52px;background:#2563eb;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 style="font-size:24px;font-weight:700;color:#f8fafc;letter-spacing:-0.4px;margin-bottom:6px;">Super Administrador</h1>
          <p style="font-size:14px;color:#94a3b8;">Acesso restrito ao painel master do sistema</p>
        </div>

        <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
          @if (error) {
            <div style="padding:12px 14px;border-radius:8px;background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);font-size:13px;margin-bottom:18px;">{{ error }}</div>
          }

          <form class="form" (ngSubmit)="submit()" style="--border:#334155;">
            <div class="form-group">
              <label style="color:#94a3b8;">E-mail administrativo</label>
              <input
                class="input"
                [(ngModel)]="email"
                name="email"
                type="email"
                placeholder="admin@system.com"
                autocomplete="username"
                required
                style="background:#0f172a;border-color:#334155;color:#f8fafc;"
              />
            </div>
            <div class="form-group">
              <label style="color:#94a3b8;">Senha</label>
              <div class="input-wrapper">
                <input
                  class="input"
                  [(ngModel)]="password"
                  name="password"
                  [type]="showPwd ? 'text' : 'password'"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  required
                  style="background:#0f172a;border-color:#334155;color:#f8fafc;padding-right:42px;"
                />
                <button type="button" class="input-action" style="color:#64748b;" (click)="showPwd = !showPwd">
                  @if (showPwd) {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  } @else {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <button class="btn btn-primary btn-block" style="margin-top:4px;padding:11px;" [disabled]="loading" type="submit">
              @if (loading) { <span class="spinner"></span> Autenticando... }
              @else { Acessar painel master }
            </button>
          </form>

          <div style="margin-top:20px;padding-top:20px;border-top:1px solid #334155;">
            <p style="margin:0 0 10px;font-size:13px;color:#94a3b8;font-weight:600;">Nova empresa na plataforma</p>
            <p style="margin:0 0 14px;font-size:12px;color:#64748b;line-height:1.5;">
              Cadastre uma clínica com banco isolado e administrador. Depois você gerencia plano e cobrança no painel, em Empresas.
            </p>
            <a
              routerLink="/signup"
              style="display:block;text-align:center;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;background:#0f172a;border:1px solid #3b82f6;color:#60a5fa;"
            >
              Cadastrar nova empresa (clínica)
            </a>
            <p style="margin:12px 0 0;font-size:11px;color:#475569;text-align:center;line-height:1.4;">
              Você será redirecionado ao cadastro público. Com o painel master aberto, use também <strong>Visão geral → Nova empresa</strong>.
            </p>
          </div>
        </div>

        <p style="text-align:center;margin-top:24px;font-size:12px;color:#475569;">
          Acesso exclusivo para administradores do sistema
        </p>
      </div>
    </div>
  `
})
export class MasterLoginComponent {
  email = ''
  password = ''
  error = ''
  loading = false
  showPwd = false

  constructor(private readonly master: MasterAdminService, private readonly router: Router) {}

  submit() {
    this.error = ''
    this.loading = true
    this.master.login(this.email.trim(), this.password).subscribe({
      next: () => { this.loading = false; this.router.navigateByUrl('/admin/dashboard') },
      error: (err: any) => {
        this.loading = false
        const m = err.error?.message
        this.error = Array.isArray(m) ? m.join(' ') : m || 'Credenciais inválidas'
      }
    })
  }
}
