import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'
import { AuthService } from '../../services/auth.service'
import { PaginationComponent } from '../../components/pagination/pagination.component'
import { paginate } from '../../utils/pagination'

type Role = 'ADMIN' | 'USER' | 'DENTIST'
type Member = { id: string; name: string; email: string | null; role: Role; createdAt: string; updatedAt?: string; createdByName?: string | null; updatedByName?: string | null }
type Quota = { plan: string; limit: number | null; used: number; remaining: number | null }

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrador', DENTIST: 'Dentista', USER: 'Equipe de apoio' }
const ROLE_CLASS: Record<Role, string> = { ADMIN: 'blue', DENTIST: '', USER: 'neutral' }

@Component({
    selector: 'app-team',
    imports: [CommonModule, FormsModule, PaginationComponent],
    template: `
    <div>
      <div class="page-header">
        <div class="page-header-left">
          <h1>Equipe</h1>
          <p>Gerencie os dentistas e a equipe de apoio da clínica</p>
        </div>
        @if (canManage) {
          <div class="page-header-actions">
            <button class="btn btn-primary" (click)="openCreate()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo membro
            </button>
          </div>
        }
      </div>

      @if (quota) {
        <div class="card team-quota">
          <div class="team-quota-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="team-quota-text">
            <strong>{{ quota.used }}{{ quota.limit !== null ? ' de ' + quota.limit : '' }} dentista{{ (quota.limit ?? quota.used) === 1 ? '' : 's' }}</strong>
            <span>no plano atual{{ quota.limit === null ? ' — sem limite' : '' }}. Recepção e equipe de apoio não contam nesse limite.</span>
          </div>
          @if (quota.limit !== null) {
            <div class="team-quota-bar"><span [style.width.%]="(quota.used / quota.limit) * 100"></span></div>
          }
        </div>
      }

      <div class="card" style="padding:0;overflow:hidden;">
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Função</th>
                <th>Criado por</th>
                <th>Atualizado por</th>
                <th style="width:80px;"></th>
              </tr>
            </thead>
            <tbody>
              @if (loading) {
                <tr><td colspan="6" class="table-empty"><span class="spinner spinner-dark"></span></td></tr>
              } @else if (members.length === 0) {
                <tr><td colspan="6">
                  <div class="empty-state">
                    <div class="empty-state-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    </div>
                    <h3>Nenhum membro cadastrado ainda</h3>
                    <p>Cadastre o primeiro dentista ou um membro da equipe de apoio.</p>
                  </div>
                </td></tr>
              } @else {
                @for (m of pagedMembers; track m.id) {
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px;">
                        <div class="patient-avatar">{{ m.name[0].toUpperCase() }}</div>
                        <span style="font-weight:500;">{{ m.name }}</span>
                      </div>
                    </td>
                    <td class="muted text-sm">
                      @if (m.email) { {{ m.email }} } @else { <span class="badge badge-neutral">Sem acesso ao sistema</span> }
                    </td>
                    <td><span class="status-chip" [class]="ROLE_CLASS[m.role]">{{ ROLE_LABEL[m.role] }}</span></td>
                    <td><div class="audit-cell"><strong>{{ m.createdByName || 'Sistema' }}</strong><span>{{ m.createdAt | date:'dd/MM/yyyy HH:mm' }}</span></div></td>
                    <td><div class="audit-cell"><strong>{{ m.updatedByName || m.createdByName || 'Sistema' }}</strong><span>{{ (m.updatedAt || m.createdAt) | date:'dd/MM/yyyy HH:mm' }}</span></div></td>
                    <td>
                      @if (canManage) {
                        <div class="table-actions">
                          <button class="btn btn-sm btn-ghost" (click)="openEdit(m)" title="Editar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button class="btn btn-sm btn-ghost" style="color:var(--danger);" (click)="confirmDelete(m)" title="Remover">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </div>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="page" [pageSize]="pageSize" [totalItems]="members.length" (pageChange)="page=$event"></app-pagination>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    @if (showModal) {
      <div class="modal-backdrop" (click)="closeOnBackdrop($event)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ editingId ? 'Editar membro' : 'Novo membro da equipe' }}</h3>
              <p>{{ editingId ? 'Atualize os dados de acesso' : 'Cadastre um dentista ou um membro de apoio' }}</p>
            </div>
            <button class="btn btn-icon" (click)="showModal=false" aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form class="form" (ngSubmit)="save()">
            @if (!editingId) {
              <div class="form-group">
                <label>Função *</label>
                <div class="team-role-picker">
                  <button type="button" class="team-role-option" [class.active]="form.role === 'DENTIST'" (click)="form.role = 'DENTIST'">
                    <strong>Dentista</strong>
                    <span>Tem a própria agenda e visão de atendimentos</span>
                  </button>
                  <button type="button" class="team-role-option" [class.active]="form.role === 'USER'" (click)="form.role = 'USER'">
                    <strong>Equipe de apoio</strong>
                    <span>Recepção e secretária — sem limite no plano</span>
                  </button>
                </div>
                @if (form.role === 'DENTIST' && quota && quota.limit !== null && quota.remaining === 0) {
                  <p class="team-quota-warning">
                    Seu plano já usa todas as {{ quota.limit }} vagas de dentista. Remova um dentista ou mude de plano para cadastrar outro.
                  </p>
                }
              </div>
            }
            <div class="form-group">
              <label>Nome *</label>
              <input class="input" [(ngModel)]="form.name" name="name" placeholder="Nome completo" required />
            </div>
            <div class="form-group">
              <label>E-mail{{ requiresLogin ? ' *' : '' }}</label>
              <input class="input" [(ngModel)]="form.email" name="email" type="email" placeholder="email@clinica.com" [required]="requiresLogin" />
              @if (form.role === 'DENTIST') {
                <small class="muted">Deixe em branco para cadastrar só como referência na agenda, sem acesso ao sistema.</small>
              }
            </div>
            <div class="grid cols-2">
              <div class="form-group">
                <label>{{ editingId ? 'Nova senha (opcional)' : (requiresLogin ? 'Senha *' : 'Senha (opcional)') }}</label>
                <div class="input-wrapper">
                  <input
                    class="input"
                    [(ngModel)]="form.password"
                    name="password"
                    [type]="showPwd ? 'text' : 'password'"
                    minlength="8"
                    [required]="!editingId && requiresLogin"
                    placeholder="Mínimo 8 caracteres"
                    style="padding-right:42px;"
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
              <div class="form-group">
                <label>{{ editingId ? 'Confirmar nova senha' : (requiresLogin ? 'Confirmar senha *' : 'Confirmar senha') }}</label>
                <input
                  class="input"
                  [(ngModel)]="passwordConfirm"
                  name="passwordConfirm"
                  [type]="showPwd ? 'text' : 'password'"
                  minlength="8"
                  [required]="(!editingId && requiresLogin) || !!form.password"
                  placeholder="Repita a senha"
                />
                @if (passwordConfirm && form.password !== passwordConfirm) {
                  <small style="color:var(--danger-text);">As senhas não coincidem.</small>
                }
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" type="button" (click)="showModal=false">Cancelar</button>
              <button class="btn btn-primary" [disabled]="saving || blockedByQuota" type="submit">
                @if (saving) { <span class="spinner"></span> }
                {{ editingId ? 'Salvar alterações' : 'Cadastrar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete Confirm -->
    @if (deleteTarget) {
      <div class="modal-backdrop" (click)="deleteTarget=null">
        <div class="modal" style="max-width:400px;" (click)="$event.stopPropagation()">
          <div style="text-align:center;padding:8px 0 16px;">
            <div style="width:48px;height:48px;background:var(--danger-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--danger);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h3 style="font-size:17px;font-weight:700;margin-bottom:8px;">Remover {{ deleteTarget.name }}?</h3>
            <p style="color:var(--muted);font-size:14px;">O acesso ao sistema será removido. Consultas já registradas em nome dessa pessoa continuam no histórico.</p>
          </div>
          <div style="display:flex;gap:10px;margin-top:16px;">
            <button class="btn btn-ghost" style="flex:1;" (click)="deleteTarget=null">Voltar</button>
            <button class="btn btn-danger" style="flex:1;" [disabled]="saving" (click)="doDelete()">
              @if (saving) { <span class="spinner"></span> } Confirmar
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class TeamComponent implements OnInit {
  canManage = false
  members: Member[] = []
  quota: Quota | null = null
  loading = false
  saving = false
  showModal = false
  editingId: string | null = null
  deleteTarget: Member | null = null
  form: { name: string; email: string; password: string; role: Role } = { name: '', email: '', password: '', role: 'DENTIST' }
  passwordConfirm = ''
  showPwd = false
  page = 1
  readonly pageSize = 15

  readonly ROLE_LABEL = ROLE_LABEL
  readonly ROLE_CLASS = ROLE_CLASS

  constructor(private http: HttpClient, private toast: ToastService, private auth: AuthService) {
    this.canManage = auth.hasPermission('TEAM_MANAGE')
  }

  ngOnInit() {
    this.load()
    this.loadQuota()
  }

  /** Só entra na vaga do plano quem vai ter acesso ao sistema — referência sem login é sempre livre. */
  get requiresLogin() {
    return this.form.role !== 'DENTIST' || !!this.form.email.trim() || !!this.form.password
  }

  get blockedByQuota() {
    return (
      !this.editingId &&
      this.form.role === 'DENTIST' &&
      !!this.form.email.trim() &&
      !!this.quota &&
      this.quota.limit !== null &&
      this.quota.remaining === 0
    )
  }

  get pagedMembers() {
    return paginate(this.members, this.page, this.pageSize)
  }

  load() {
    this.loading = true
    this.http.get<Member[]>('/api/users').subscribe({
      next: res => { this.members = res.filter(m => m.role !== 'ADMIN'); this.page = 1; this.loading = false },
      error: () => { this.loading = false; this.toast.error('Falha ao carregar a equipe') }
    })
  }

  loadQuota() {
    this.http.get<Quota>('/api/users/dentist-quota').subscribe({ next: res => this.quota = res })
  }

  openCreate() {
    this.editingId = null
    this.form = { name: '', email: '', password: '', role: 'DENTIST' }
    this.passwordConfirm = ''
    this.showModal = true
  }

  openEdit(m: Member) {
    this.editingId = m.id
    this.form = { name: m.name, email: m.email || '', password: '', role: m.role }
    this.passwordConfirm = ''
    this.showModal = true
  }

  save() {
    if (this.blockedByQuota) return
    if (this.form.password !== this.passwordConfirm) {
      this.toast.error('As senhas não coincidem')
      return
    }
    if (this.form.role === 'DENTIST' && Boolean(this.form.email.trim()) !== Boolean(this.form.password)) {
      this.toast.error('Informe e-mail e senha juntos para dar acesso, ou deixe os dois em branco.')
      return
    }
    this.saving = true
    if (this.editingId) {
      const body: Record<string, string> = { name: this.form.name, email: this.form.email }
      if (this.form.password) body.password = this.form.password
      this.http.patch(`/api/users/${this.editingId}`, body).subscribe({
        next: () => {
          this.saving = false; this.showModal = false
          this.toast.success('Membro atualizado')
          this.load()
        },
        error: (err: any) => { this.saving = false; this.toast.error('Erro ao salvar', err.error?.message) }
      })
      return
    }
    // E-mail/senha em branco precisam ficar de fora do corpo (não como string vazia) para o
    // cadastro sem login funcionar — @IsOptional() só pula a validação quando o campo nem vem.
    const body: Record<string, unknown> = { name: this.form.name, role: this.form.role }
    if (this.form.email.trim()) body.email = this.form.email.trim()
    if (this.form.password) body.password = this.form.password
    this.http.post('/api/users', body).subscribe({
      next: () => {
        this.saving = false; this.showModal = false
        this.toast.success('Membro cadastrado com sucesso')
        this.load(); this.loadQuota()
      },
      error: (err: any) => { this.saving = false; this.toast.error('Erro ao cadastrar', err.error?.message) }
    })
  }

  confirmDelete(m: Member) { this.deleteTarget = m }

  doDelete() {
    if (!this.deleteTarget) return
    this.saving = true
    this.http.delete(`/api/users/${this.deleteTarget.id}`).subscribe({
      next: () => {
        this.saving = false; this.deleteTarget = null
        this.toast.success('Membro removido')
        this.load(); this.loadQuota()
      },
      error: (err: any) => { this.saving = false; this.toast.error('Erro ao remover', err.error?.message) }
    })
  }

  closeOnBackdrop(ev: MouseEvent) {
    if ((ev.target as HTMLElement).classList.contains('modal-backdrop')) this.showModal = false
  }
}
