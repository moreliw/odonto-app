import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="auth-layout">
      <div class="auth-card">
        <div class="auth-card-header">
          <img src="/assets/logo.svg" alt="Odonto Platform" />
          <h2>Bem-vindo de volta</h2>
          <p>Faça login para acessar sua clínica</p>
        </div>

        <form class="form" (ngSubmit)="submit()">
          <div>
            <label>Usuário ou e-mail</label>
            <input
              class="input"
              [(ngModel)]="identifier"
              name="identifier"
              placeholder="ex.: dr.leonardo"
              required
            />
          </div>
          <div>
            <div
              style="display: flex; justify-content: space-between; align-items: baseline;"
            >
              <label>Senha</label>
            </div>
            <div style="position: relative">
              <input
                class="input"
                [(ngModel)]="password"
                name="password"
                [type]="showPassword ? 'text' : 'password'"
                required
                style="padding-right: 48px;"
              />
              <button
                class="btn btn-link"
                type="button"
                (click)="togglePassword()"
                style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); padding: 4px; text-decoration: none; font-size: 12px; color: var(--muted)"
              >
                {{ showPassword ? "Ocultar" : "Mostrar" }}
              </button>
            </div>
          </div>
          <button
            class="btn btn-primary btn-block mt-2"
            [disabled]="loading"
            type="submit"
          >
            {{ loading ? "Entrando..." : "Entrar na conta" }}
          </button>

          <div
            style="text-align: center; margin-top: 24px; font-size: 14px; color: var(--muted)"
          >
            Não tem uma conta?
            <a
              routerLink="/signup"
              style="color: var(--primary); font-weight: 500; text-decoration: none"
              >Criar clínica</a
            >
          </div>
        </form>

        <div
          *ngIf="error"
          class="mt-3"
          style="padding: 12px; border-radius: 8px; background: #fef2f2; color: #ef4444; font-size: 14px; text-align: center;"
        >
          {{ error }}
        </div>
      </div>
    </section>
  `,
})
export class LoginComponent {
  identifier = "";
  password = "";
  error = "";
  loading = false;
  showPassword = false;
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  submit() {
    this.error = "";
    this.loading = true;
    const identifier = this.identifier.trim();
    this.auth.login(identifier, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl("/");
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || "Credenciais inválidas";
      },
    });
  }
}
