import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'
import { AuthService } from '../../services/auth.service'
import { BrandingService } from '../../services/branding.service'

type Role = 'ADMIN' | 'USER' | 'DENTIST'
type Me = { id: string; username: string | null; email: string; name: string; role: Role; active: boolean; createdAt: string }

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrador', DENTIST: 'Dentista', USER: 'Equipe de apoio' }

@Component({
    selector: 'app-profile',
    imports: [CommonModule, FormsModule],
    template: `
    <div>
      <div class="page-header">
        <div class="page-header-left">
          <h1>Meu perfil</h1>
          <p>Suas informações de conta e acesso à clínica</p>
        </div>
      </div>

      @if (loading) {
        <div class="card" style="padding:48px;text-align:center;">
          <span class="spinner spinner-dark"></span>
        </div>
      } @else if (me) {
        <div class="grid cols-2">
          <div class="card" style="align-self:start;">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
              <div class="avatar" style="width:56px;height:56px;font-size:20px;">{{ initial }}</div>
              <div style="min-width:0;">
                <strong style="display:block;font-size:16px;color:var(--text);">{{ me.name }}</strong>
                <span class="status-chip blue" style="margin-top:4px;">{{ ROLE_LABEL[me.role] }}</span>
              </div>
            </div>

            <dl style="display:grid;gap:12px;font-size:13.5px;">
              <div>
                <dt class="muted text-xs">E-mail</dt>
                <dd style="color:var(--text);margin-top:2px;">{{ me.email }}</dd>
              </div>
              @if (me.username) {
                <div>
                  <dt class="muted text-xs">Usuário</dt>
                  <dd style="color:var(--text);margin-top:2px;">{{ me.username }}</dd>
                </div>
              }
              <div>
                <dt class="muted text-xs">Status</dt>
                <dd style="margin-top:2px;">
                  <span class="badge" [class.badge-success]="me.active" [class.badge-neutral]="!me.active">{{ me.active ? 'Ativo' : 'Inativo' }}</span>
                </dd>
              </div>
              <div>
                <dt class="muted text-xs">Membro desde</dt>
                <dd style="color:var(--text);margin-top:2px;">{{ me.createdAt | date:'dd/MM/yyyy' }}</dd>
              </div>
            </dl>

            @if (clinicName) {
              <hr style="border:none;border-top:1px solid var(--border);margin:18px 0;" />
              <div style="display:flex;align-items:center;gap:10px;">
                @if (logoUrl) {
                  <img [src]="logoUrl" width="32" height="32" alt="" style="border-radius:8px;object-fit:contain;flex-shrink:0;" />
                } @else {
                  <div class="avatar" style="width:32px;height:32px;font-size:12px;">{{ clinicName[0].toUpperCase() }}</div>
                }
                <div style="min-width:0;">
                  <div class="muted text-xs">Clínica</div>
                  <strong class="text-sm truncate" style="display:block;color:var(--text);">{{ clinicName }}</strong>
                </div>
              </div>
            }
          </div>

          <div class="card">
            <h2>Editar informações</h2>
            <form class="form" (ngSubmit)="saveInfo()">
              <div class="form-group">
                <label>Nome completo</label>
                <input class="input" [(ngModel)]="infoForm.name" name="name" required />
              </div>
              <div class="form-group">
                <label>E-mail</label>
                <input class="input" type="email" [(ngModel)]="infoForm.email" name="email" required />
              </div>
              <div>
                <button class="btn btn-primary" type="submit" [disabled]="savingInfo">
                  @if (savingInfo) { <span class="spinner"></span> } {{ savingInfo ? 'Salvando...' : 'Salvar informações' }}
                </button>
              </div>
            </form>

            <hr style="border:none;border-top:1px solid var(--border);margin:22px 0;" />

            <h2>Alterar senha</h2>
            <form class="form" (ngSubmit)="savePassword()">
              <div class="form-group">
                <label>Nova senha</label>
                <div class="input-wrapper">
                  <input
                    class="input"
                    [(ngModel)]="pwdForm.newPassword"
                    name="newPassword"
                    [type]="showPwd ? 'text' : 'password'"
                    minlength="8"
                    placeholder="Mínimo 8 caracteres"
                    style="padding-right:42px;"
                  />
                  <button type="button" class="input-action" (click)="showPwd = !showPwd" [attr.aria-label]="showPwd ? 'Ocultar senha' : 'Mostrar senha'">
                    @if (showPwd) {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    } @else {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label>Confirmar nova senha</label>
                <input
                  class="input"
                  [(ngModel)]="pwdForm.confirm"
                  name="confirm"
                  [type]="showPwd ? 'text' : 'password'"
                  minlength="8"
                  placeholder="Repita a senha"
                />
                @if (pwdForm.confirm && pwdForm.newPassword !== pwdForm.confirm) {
                  <small style="color:var(--danger-text);">As senhas não coincidem.</small>
                }
              </div>
              <div>
                <button class="btn btn-outline" type="submit" [disabled]="savingPwd || !pwdForm.newPassword">
                  @if (savingPwd) { <span class="spinner spinner-dark"></span> } {{ savingPwd ? 'Salvando...' : 'Atualizar senha' }}
                </button>
              </div>
            </form>
          </div>

        </div>
      }
    </div>
  `
})
export class ProfileComponent implements OnInit {
  me: Me | null = null
  loading = false
  savingInfo = false
  savingPwd = false
  showPwd = false
  clinicName: string | null = null
  logoUrl: string | null = null
  readonly ROLE_LABEL = ROLE_LABEL

  infoForm = { name: '', email: '' }
  pwdForm = { newPassword: '', confirm: '' }

  constructor(
    private readonly http: HttpClient,
    private readonly toast: ToastService,
    private readonly auth: AuthService,
    private readonly branding: BrandingService
  ) {}

  ngOnInit() {
    this.load()
    this.branding.branding$.subscribe(b => {
      this.clinicName = b.name
      this.logoUrl = b.logoUrl
    })
  }

  get initial() {
    return (this.me?.name?.[0] || 'U').toUpperCase()
  }

  load() {
    this.loading = true
    this.http.get<Me>('/api/users/me').subscribe({
      next: res => {
        this.me = res
        this.infoForm = { name: res.name, email: res.email }
        this.loading = false
      },
      error: () => {
        this.loading = false
        this.toast.error('Não foi possível carregar seu perfil')
      }
    })
  }

  saveInfo() {
    if (!this.me || this.savingInfo) return
    this.savingInfo = true
    this.http.patch<Me>(`/api/users/${this.me.id}`, { name: this.infoForm.name, email: this.infoForm.email }).subscribe({
      next: res => {
        this.savingInfo = false
        this.me = res
        this.auth.patchUser({ name: res.name, email: res.email })
        this.toast.success('Perfil atualizado')
      },
      error: (err: any) => {
        this.savingInfo = false
        this.toast.error('Erro ao salvar', err.error?.message)
      }
    })
  }

  savePassword() {
    if (!this.me || this.savingPwd || !this.pwdForm.newPassword) return
    if (this.pwdForm.newPassword !== this.pwdForm.confirm) {
      this.toast.error('As senhas não coincidem')
      return
    }
    this.savingPwd = true
    this.http.patch(`/api/users/${this.me.id}`, { password: this.pwdForm.newPassword }).subscribe({
      next: () => {
        this.savingPwd = false
        this.pwdForm = { newPassword: '', confirm: '' }
        this.showPwd = false
        this.toast.success('Senha atualizada com sucesso')
      },
      error: (err: any) => {
        this.savingPwd = false
        this.toast.error('Erro ao atualizar senha', err.error?.message)
      }
    })
  }
}
