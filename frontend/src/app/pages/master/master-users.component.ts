import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'
import { AuthService, User } from '../../services/auth.service'
import { ToastService } from '../../services/toast.service'

type ClinicOption = { id: string; name: string; subdomain: string }
type MasterTenantUser = {
  id: string
  username?: string | null
  email: string
  name: string
  role: 'ADMIN' | 'USER' | 'DENTIST'
  active: boolean
  createdAt: string
  updatedAt: string
  _count?: { appointments: number; invoices: number }
}

@Component({
  selector: 'app-master-users',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Usuários das clínicas</h1>
          <p>Crie, edite, bloqueie e acesse contas para suporte assistido.</p>
        </div>
        <div class="page-header-actions">
          <button type="button" class="btn btn-primary btn-sm" [disabled]="!selectedClinicId" (click)="openCreate()">Novo usuário</button>
          <button type="button" class="btn btn-outline btn-sm" (click)="loadUsers()" [disabled]="!selectedClinicId || loading">Atualizar</button>
        </div>
      </div>

      <div class="card master-filter-card">
        <div class="master-filter-grid">
          <div class="form-group">
            <label for="master-user-clinic">Clínica</label>
            <select id="master-user-clinic" class="select" [(ngModel)]="selectedClinicId" (ngModelChange)="loadUsers()">
              @for (clinic of clinics; track clinic.id) {
                <option [value]="clinic.id">{{ clinic.name }} · {{ clinic.subdomain }}</option>
              }
            </select>
          </div>
          <div class="form-group">
            <label for="master-user-search">Buscar usuário</label>
            <input id="master-user-search" class="input" [(ngModel)]="search" placeholder="Nome, e-mail ou usuário" />
          </div>
          <div class="form-group">
            <label for="master-user-status">Status</label>
            <select id="master-user-status" class="select" [(ngModel)]="statusFilter">
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Bloqueados</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr><th>Usuário</th><th>Login</th><th>Perfil</th><th>Status</th><th>Agenda</th><th>Faturas</th><th>Criado em</th><th></th></tr>
            </thead>
            <tbody>
              @if (loading) {
                <tr><td colspan="8" class="table-empty"><span class="spinner spinner-dark"></span></td></tr>
              } @else if (filteredUsers.length === 0) {
                <tr><td colspan="8" class="table-empty">Nenhum usuário encontrado nesta clínica.</td></tr>
              }
              @for (user of filteredUsers; track user.id) {
                <tr [class.master-row-inactive]="!user.active">
                  <td>
                    <div class="master-user-cell">
                      <div class="avatar" [class.admin]="user.role === 'ADMIN'">{{ initials(user.name) }}</div>
                      <div><strong>{{ user.name }}</strong><small>{{ user.email }}</small></div>
                    </div>
                  </td>
                  <td class="muted text-sm">{{ user.username || '—' }}</td>
                  <td><span class="badge" [class.badge-blue]="user.role === 'ADMIN'" [class.badge-neutral]="user.role !== 'ADMIN'">{{ roleLabel(user.role) }}</span></td>
                  <td><span class="badge" [class.badge-success]="user.active" [class.badge-danger]="!user.active">{{ user.active ? 'Ativo' : 'Bloqueado' }}</span></td>
                  <td>{{ user._count?.appointments || 0 }}</td>
                  <td>{{ user._count?.invoices || 0 }}</td>
                  <td class="muted text-sm">{{ user.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td>
                    <div class="table-actions">
                      <button type="button" class="btn btn-sm btn-outline" (click)="openEdit(user)">Editar</button>
                      @if (user.active) {
                        <button type="button" class="btn btn-sm btn-ghost" (click)="startSupport(user)" title="Entrar como este usuário">Acessar</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (modalOpen) {
      <div class="master-modal-backdrop" (click)="closeOnBackdrop($event)">
        <div class="master-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" [attr.aria-labelledby]="editingUser ? 'edit-user-title' : 'create-user-title'">
          <div class="modal-header">
            <div>
              <h3 [id]="editingUser ? 'edit-user-title' : 'create-user-title'">{{ editingUser ? 'Editar usuário' : 'Novo usuário' }}</h3>
              <p>{{ selectedClinic?.name }}</p>
            </div>
            <button type="button" class="btn btn-icon" (click)="closeModal()" aria-label="Fechar">×</button>
          </div>

          <form class="form" (ngSubmit)="save()">
            <div class="grid cols-2">
              <div class="form-group">
                <label for="master-user-name">Nome</label>
                <input id="master-user-name" class="input" [(ngModel)]="form.name" name="name" required />
              </div>
              <div class="form-group">
                <label for="master-user-username">Usuário</label>
                <input id="master-user-username" class="input" [(ngModel)]="form.username" name="username" pattern="[a-zA-Z0-9_.-]{3,32}" placeholder="gerado pelo e-mail" />
              </div>
            </div>
            <div class="form-group">
              <label for="master-user-email">E-mail</label>
              <input id="master-user-email" class="input" [(ngModel)]="form.email" name="email" type="email" required />
            </div>
            <div class="grid cols-2">
              <div class="form-group">
                <label for="master-user-role">Perfil</label>
                <select id="master-user-role" class="select" [(ngModel)]="form.role" name="role">
                  <option value="ADMIN">Administrador</option>
                  <option value="DENTIST">Dentista</option>
                  <option value="USER">Equipe / recepção</option>
                </select>
              </div>
              <div class="form-group">
                <label for="master-user-active">Acesso</label>
                <select id="master-user-active" class="select" [(ngModel)]="form.active" name="active">
                  <option [ngValue]="true">Ativo</option>
                  <option [ngValue]="false">Bloqueado</option>
                </select>
              </div>
            </div>
            <div class="grid cols-2">
              <div class="form-group">
                <label for="master-user-password">{{ editingUser ? 'Nova senha (opcional)' : 'Senha' }}</label>
                <div class="input-wrapper">
                  <input id="master-user-password" class="input" [(ngModel)]="form.password" name="password" [type]="showPassword ? 'text' : 'password'" [required]="!editingUser" minlength="8" autocomplete="new-password" style="padding-right:42px;" />
                  <button type="button" class="input-action" (click)="showPassword=!showPassword" [attr.aria-label]="showPassword ? 'Ocultar senha' : 'Mostrar senha'">
                    @if (showPassword) {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    } @else {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label for="master-user-password-confirm">Confirmar senha</label>
                <div class="input-wrapper">
                  <input id="master-user-password-confirm" class="input" [(ngModel)]="form.passwordConfirm" name="passwordConfirm" [type]="showPasswordConfirm ? 'text' : 'password'" [required]="!editingUser || !!form.password" minlength="8" autocomplete="new-password" style="padding-right:42px;" />
                  <button type="button" class="input-action" (click)="showPasswordConfirm=!showPasswordConfirm" [attr.aria-label]="showPasswordConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'">
                    @if (showPasswordConfirm) {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    } @else {
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                @if (form.passwordConfirm && form.password !== form.passwordConfirm) { <small class="master-form-error">As senhas não coincidem.</small> }
              </div>
            </div>
            @if (message) { <div class="master-inline-alert master-inline-alert--danger">{{ message }}</div> }
            <div class="master-modal-actions">
              <button type="submit" class="btn btn-primary" [disabled]="saving">{{ saving ? 'Salvando...' : 'Salvar usuário' }}</button>
              <button type="button" class="btn btn-ghost" (click)="closeModal()">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class MasterUsersComponent implements OnInit {
  clinics: ClinicOption[] = []
  users: MasterTenantUser[] = []
  selectedClinicId = ''
  search = ''
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL'
  loading = false
  modalOpen = false
  editingUser: MasterTenantUser | null = null
  saving = false
  message = ''
  showPassword = false
  showPasswordConfirm = false
  form = this.emptyForm()

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toast: ToastService
  ) {}

  ngOnInit() {
    this.http.get<ClinicOption[]>('/api/master/clinics').subscribe({
      next: clinics => {
        this.clinics = clinics
        this.selectedClinicId = clinics[0]?.id || ''
        this.loadUsers()
      },
      error: () => this.toast.error('Não foi possível carregar as clínicas.')
    })
  }

  get selectedClinic() { return this.clinics.find(item => item.id === this.selectedClinicId) }

  get filteredUsers() {
    const term = this.search.trim().toLowerCase()
    return this.users.filter(user => {
      const matchesStatus = this.statusFilter === 'ALL' || (this.statusFilter === 'ACTIVE' ? user.active : !user.active)
      const matchesTerm = !term || [user.name, user.email, user.username || '', user.role].some(value => value.toLowerCase().includes(term))
      return matchesStatus && matchesTerm
    })
  }

  loadUsers() {
    if (!this.selectedClinicId) { this.users = []; return }
    this.loading = true
    this.http.get<MasterTenantUser[]>(`/api/master/clinics/${this.selectedClinicId}/users`).subscribe({
      next: users => { this.loading = false; this.users = users },
      error: () => { this.loading = false; this.users = []; this.toast.error('Falha ao carregar os usuários.') }
    })
  }

  openCreate() { this.editingUser = null; this.form = this.emptyForm(); this.openModal() }

  openEdit(user: MasterTenantUser) {
    this.editingUser = user
    this.form = { username: user.username || '', email: user.email, name: user.name, role: user.role, active: user.active, password: '', passwordConfirm: '' }
    this.openModal()
  }

  private openModal() { this.message = ''; this.showPassword = false; this.showPasswordConfirm = false; this.modalOpen = true }
  closeModal() { this.modalOpen = false; this.editingUser = null }

  save() {
    if (this.saving || !this.selectedClinicId) return
    this.message = ''
    if (this.form.password !== this.form.passwordConfirm) { this.message = 'As senhas não coincidem.'; return }
    this.saving = true
    const body: Record<string, unknown> = {
      username: this.form.username.trim() || undefined,
      email: this.form.email.trim(),
      name: this.form.name.trim(),
      role: this.form.role,
      active: this.form.active
    }
    if (this.form.password) body['password'] = this.form.password
    const request = this.editingUser
      ? this.http.patch(`/api/master/clinics/${this.selectedClinicId}/users/${this.editingUser.id}`, body)
      : this.http.post(`/api/master/clinics/${this.selectedClinicId}/users`, body)
    request.subscribe({
      next: () => { this.saving = false; this.closeModal(); this.loadUsers(); this.toast.success('Usuário salvo com sucesso.') },
      error: (error: any) => { this.saving = false; this.message = error.error?.message || 'Não foi possível salvar o usuário.' }
    })
  }

  startSupport(user: MasterTenantUser) {
    if (!this.selectedClinicId) return
    this.http.post<any>(`/api/master/clinics/${this.selectedClinicId}/support-session`, { userId: user.id }).subscribe({
      next: result => {
        this.auth.setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user as User, tenant: result.tenant })
        localStorage.setItem('masterSupportSession', JSON.stringify({ clinicName: result.clinic?.name, userName: result.user?.name }))
        this.router.navigateByUrl('/app')
      },
      error: (error: any) => this.toast.error(error.error?.message || 'Não foi possível iniciar o acesso assistido.')
    })
  }

  roleLabel(role: MasterTenantUser['role']) { return role === 'ADMIN' ? 'Administrador' : role === 'DENTIST' ? 'Dentista' : 'Equipe' }
  initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(item => item[0]).join('').toUpperCase() || 'U' }
  closeOnBackdrop(event: MouseEvent) { if ((event.target as HTMLElement).classList.contains('master-modal-backdrop')) this.closeModal() }

  private emptyForm() {
    return { username: '', email: '', name: '', role: 'USER' as MasterTenantUser['role'], active: true, password: '', passwordConfirm: '' }
  }
}
