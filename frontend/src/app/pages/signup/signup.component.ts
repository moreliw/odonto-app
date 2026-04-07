import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="grid">
      <div class="card" style="max-width:640px; margin:auto">
        <h2>Crie sua clínica</h2>
        <form class="form" (ngSubmit)="submit()">
          <div>
            <label>Nome da clínica</label>
            <input class="input" [(ngModel)]="name" name="name" required />
          </div>
          <div class="grid cols-2">
            <div>
              <label>Email do admin</label>
              <input class="input" [(ngModel)]="adminEmail" name="adminEmail" type="email" required />
            </div>
            <div>
              <label>Senha</label>
              <input class="input" [(ngModel)]="adminPassword" name="adminPassword" type="password" required />
            </div>
          </div>
          <div>
            <label>Plano</label>
            <select class="select" [(ngModel)]="plan" name="plan">
              <option value="BASIC">BASIC — R$ 49/mês</option>
              <option value="PRO">PRO — R$ 99/mês</option>
            </select>
          </div>
          <button class="btn btn-primary" type="submit">Criar</button>
        </form>
        <p *ngIf="message" class="mt-3">{{message}}</p>
      </div>
    </div>
  `
})
export class SignupComponent {
  name = ''
  adminEmail = ''
  adminPassword = ''
  plan: 'BASIC' | 'PRO' = 'BASIC'
  message = ''
  constructor(private http: HttpClient, private router: Router) {}
  submit() {
    this.http.post<{ ok: boolean; subdomain: string; slug: string }>(`/api/public/signup`, { name: this.name, adminEmail: this.adminEmail, adminPassword: this.adminPassword, plan: this.plan }).subscribe({
      next: res => {
        localStorage.setItem('tenant', res.subdomain)
        this.message = `Empresa criada: subdomínio ${res.subdomain}. Faça login para acessar.`
        this.router.navigateByUrl('/login')
      },
      error: err => (this.message = err.error?.message || 'Falha ao criar empresa')
    })
  }
}
