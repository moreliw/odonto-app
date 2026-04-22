import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { Router, RouterLink } from '@angular/router'

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div>
      <div class="page-header">
        <div class="page-header-left">
          <h1>Criar nova clínica</h1>
          <p>Provisiona um banco de dados isolado e configura o administrador inicial</p>
        </div>
      </div>

      <div style="max-width:640px;">
        <div class="card">
          @if (message) {
            <div style="padding:14px;border-radius:8px;margin-bottom:18px;"
              [style.background]="success ? 'var(--success-bg)' : 'var(--danger-bg)'"
              [style.color]="success ? 'var(--success-text)' : 'var(--danger-text)'"
              [style.border]="success ? '1px solid #bbf7d0' : '1px solid #fecaca'"
            >{{ message }}</div>
          }

          <form class="form" (ngSubmit)="submit()">
            <div class="form-group">
              <label>Nome da clínica *</label>
              <input class="input" [(ngModel)]="name" name="name" placeholder="Ex.: Clínica Saúde & Sorriso" required />
            </div>

            <div class="form-group">
              <label>Subdomínio <span class="muted" style="font-weight:400;">(opcional — gerado automaticamente)</span></label>
              <input class="input" [(ngModel)]="subdomain" name="subdomain" placeholder="ex.: saude-sorriso" />
              <span class="text-xs muted">Usado para identificar a clínica na plataforma</span>
            </div>

            <div class="grid cols-2">
              <div class="form-group">
                <label>E-mail do administrador *</label>
                <input class="input" [(ngModel)]="adminEmail" name="adminEmail" type="email" placeholder="admin@clinica.com" required />
              </div>
              <div class="form-group">
                <label>Senha inicial *</label>
                <input class="input" [(ngModel)]="adminPassword" name="adminPassword" type="password" placeholder="Mínimo 8 caracteres" required minlength="8" />
              </div>
            </div>

            <div class="form-group">
              <label>Plano</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px;">
                <div
                  style="border:2px solid;border-radius:10px;padding:16px;cursor:pointer;transition:all 0.15s;"
                  [style.border-color]="plan === 'BASIC' ? 'var(--primary)' : 'var(--border)'"
                  [style.background]="plan === 'BASIC' ? 'var(--primary-50)' : 'var(--surface)'"
                  (click)="plan = 'BASIC'"
                >
                  <div style="font-weight:700;font-size:15px;color:var(--text);">BASIC</div>
                  <div style="font-size:22px;font-weight:800;color:var(--primary);margin:6px 0;">R$ 49<span style="font-size:13px;font-weight:400;color:var(--muted);">/mês</span></div>
                  <div class="text-xs muted">Ideal para clínicas pequenas</div>
                </div>
                <div
                  style="border:2px solid;border-radius:10px;padding:16px;cursor:pointer;transition:all 0.15s;"
                  [style.border-color]="plan === 'PRO' ? 'var(--primary)' : 'var(--border)'"
                  [style.background]="plan === 'PRO' ? 'var(--primary-50)' : 'var(--surface)'"
                  (click)="plan = 'PRO'"
                >
                  <div style="font-weight:700;font-size:15px;color:var(--text);">PRO</div>
                  <div style="font-size:22px;font-weight:800;color:var(--primary);margin:6px 0;">R$ 99<span style="font-size:13px;font-weight:400;color:var(--muted);">/mês</span></div>
                  <div class="text-xs muted">Multi-usuários e relatórios</div>
                </div>
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:6px;">
              <a routerLink="/" class="btn btn-ghost">Cancelar</a>
              <button class="btn btn-primary" [disabled]="saving" type="submit">
                @if (saving) { <span class="spinner"></span> Criando clínica... }
                @else { Criar clínica }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class SignupComponent {
  name = ''
  subdomain = ''
  adminEmail = ''
  adminPassword = ''
  plan: 'BASIC' | 'PRO' = 'BASIC'
  message = ''
  success = false
  saving = false

  constructor(private http: HttpClient, private router: Router) {}

  submit() {
    this.message = ''
    this.saving = true
    const body: any = { name: this.name, adminEmail: this.adminEmail, adminPassword: this.adminPassword, plan: this.plan }
    if (this.subdomain.trim()) body.subdomain = this.subdomain.trim()
    this.http.post<{ ok: boolean; subdomain: string }>('/api/public/signup', body).subscribe({
      next: res => {
        this.saving = false
        this.success = true
        this.message = `Clínica criada! Subdomínio: ${res.subdomain}. Você será redirecionado para o login.`
        localStorage.setItem('tenant', res.subdomain)
        setTimeout(() => this.router.navigateByUrl('/login'), 2500)
      },
      error: err => {
        this.saving = false
        this.success = false
        this.message = err.error?.message || 'Falha ao criar clínica. Tente novamente.'
      }
    })
  }
}
