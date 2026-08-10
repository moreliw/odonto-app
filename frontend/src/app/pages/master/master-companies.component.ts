import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'
import { AuthService, User } from '../../services/auth.service'
import { Router } from '@angular/router'

type ClinicRow = {
  id: string; name: string; subdomain: string; slug: string; internalNotes?: string | null
  active?: boolean
  primaryColor?: string | null; logoUrl?: string | null
  subscription?: { plan: string; status: string; priceCents: number; currency: string; renewsAt?: string | null; canceledAt?: string | null } | null
  accessGrant?: { id: string; plan: string; dentistLimit?: number | null; reason?: string | null; expiresAt?: string | null; active: boolean; stopBilling: boolean; revokedAt?: string | null } | null
  loginIdentities?: { email: string }[]
}

type PaymentEventRow = {
  id: string
  type: string
  status: string
  receivedAt: string
  processedAt?: string | null
  error?: string | null
}

const STATUS_CLASS: Record<string, string> = { PENDING: 'neutral', ACTIVE: '', TRIAL: 'pending', PAST_DUE: 'late', CANCELED: 'neutral' }

@Component({
    selector: 'app-master-companies',
    imports: [CommonModule, FormsModule],
    template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Empresas</h1>
          <p>Gerencie plano, cobrança, status e redefinição de senha das clínicas</p>
        </div>
        <div class="page-header-actions">
          <span class="badge badge-neutral">{{ filteredClinics.length }} de {{ clinics.length }}</span>
          <button type="button" class="btn btn-outline btn-sm" (click)="load()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Atualizar
          </button>
        </div>
      </div>

      <div class="card master-filter-card">
        <div class="master-filter-grid">
          <div class="form-group master-filter-search">
            <label for="master-clinic-search">Buscar clínica</label>
            <input id="master-clinic-search" class="input" [(ngModel)]="search" placeholder="Nome, subdomínio ou e-mail do administrador" />
          </div>
          <div class="form-group">
            <label for="master-clinic-status">Status</label>
            <select id="master-clinic-status" class="select" [(ngModel)]="statusFilter">
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativas</option>
              <option value="BLOCKED">Bloqueadas</option>
              <option value="BENEFIT">Com benefício</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Subdomínio</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Mensalidade</th>
                <th>Admin</th>
                <th style="width:100px;"></th>
              </tr>
            </thead>
            <tbody>
              @if (clinics.length === 0) {
                <tr><td colspan="7">
                  <div class="empty-state">
                    <div class="empty-state-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                    </div>
                    <h3>Nenhuma empresa cadastrada</h3>
                    <p>Use "Visão geral" para criar a primeira empresa</p>
                  </div>
                </td></tr>
              }
              @for (c of filteredClinics; track c.id) {
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div class="avatar" style="background:var(--primary-100);color:var(--primary-600);font-size:13px;">{{ c.name[0].toUpperCase() }}</div>
                      <strong [style.opacity]="c.active === false ? 0.6 : 1">{{ c.name }}</strong>
                    </div>
                  </td>
                  <td class="muted text-sm">{{ c.subdomain }}</td>
                  <td>
                    <div class="master-badge-stack">
                      <span class="badge" [class.badge-blue]="effectivePlan(c) === 'PRO'" [class.badge-neutral]="effectivePlan(c) !== 'PRO'">{{ effectivePlan(c) }}</span>
                      @if (isGrantActive(c.accessGrant)) { <span class="badge badge-success">Benefício</span> }
                    </div>
                  </td>
                  <td>
                    @if (c.active === false) {
                      <span class="status-chip late">INATIVA</span>
                    } @else if (isGrantActive(c.accessGrant)) {
                      <span class="status-chip">BENEFÍCIO ATIVO</span>
                    } @else {
                      <span class="status-chip" [class]="STATUS_CLASS[c.subscription?.status || ''] || ''">{{ c.subscription?.status || '—' }}</span>
                    }
                  </td>
                  <td class="text-sm">{{ isGrantActive(c.accessGrant) ? 'R$ 0,00' : 'R$ ' + (((c.subscription?.priceCents || 0) / 100) | number:'1.2-2') }}</td>
                  <td class="muted text-sm truncate" style="max-width:160px;">{{ c.loginIdentities?.[0]?.email || '—' }}</td>
                  <td>
                    <button type="button" class="btn btn-sm btn-outline" (click)="openEdit(c)">Gerenciar</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (editing) {
      <div class="master-modal-backdrop" (click)="closeOnBackdrop($event)">
        <div class="master-modal master-modal-lg" (click)="$event.stopPropagation()">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;">
            <div>
              <h3>
                {{ editing.name }}
                @if (editing.active === false) { <span class="badge badge-danger" style="margin-left:8px;vertical-align:middle;">Inativa</span> }
              </h3>
              <p class="muted text-sm">ID: {{ editing.id }} · slug: {{ editing.slug }}</p>
            </div>
            <button class="btn btn-icon btn-sm" (click)="editing=null" aria-label="Fechar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="master-clinic-actions">
            <button type="button" class="btn btn-primary btn-sm" (click)="startSupport()" [disabled]="supportLoading">
              {{ supportLoading ? 'Preparando acesso...' : 'Acessar clínica para suporte' }}
            </button>
            <a class="btn btn-outline btn-sm" [href]="clinicUrl(editing)" target="_blank" rel="noopener">Abrir login da clínica</a>
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-danger-outline]="editing.active !== false"
              [class.btn-outline]="editing.active === false"
              (click)="toggleActive()"
              [disabled]="activeSaving"
            >
              {{ activeSaving ? 'Processando...' : editing.active === false ? 'Reativar clínica' : 'Inativar clínica' }}
            </button>
          </div>

          <form class="form" (ngSubmit)="saveEdit()">
            <div class="grid cols-2">
              <div class="form-group">
                <label>Nome</label>
                <input class="input" [(ngModel)]="editForm.name" name="e_name" required />
              </div>
              <div class="form-group">
                <label>Subdomínio</label>
                <input class="input" [(ngModel)]="editForm.subdomain" name="e_sub" required />
              </div>
            </div>

            <div class="form-group">
              <label>Notas internas</label>
              <textarea class="textarea" [(ngModel)]="editForm.internalNotes" name="e_notes" rows="3" placeholder="Contrato, observações comerciais..."></textarea>
            </div>

            <div class="master-section-head" style="margin-top:4px;">
              <div>
                <h4>Identidade visual</h4>
                <p>Cor e logo aplicados no app da clínica após o login. Deixe em branco para usar o padrão do OdontoApp.</p>
              </div>
            </div>
            <div class="grid cols-2">
              <div class="form-group">
                <label>Cor primária</label>
                <div style="display:flex;align-items:center;gap:8px;">
                  <input
                    type="color"
                    [ngModel]="editForm.primaryColor || '#2563eb'"
                    (ngModelChange)="editForm.primaryColor = $event"
                    name="e_color_picker"
                    style="width:40px;height:38px;padding:2px;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;flex-shrink:0;"
                  />
                  <input class="input" [(ngModel)]="editForm.primaryColor" name="e_color" placeholder="#2563eb (padrão)" />
                </div>
              </div>
              <div class="form-group">
                <label>URL do logo</label>
                <div style="display:flex;align-items:center;gap:8px;">
                  @if (editForm.logoUrl) {
                    <img [src]="editForm.logoUrl" alt="" width="34" height="34" style="border-radius:8px;object-fit:contain;border:1px solid var(--border);flex-shrink:0;" />
                  }
                  <input class="input" [(ngModel)]="editForm.logoUrl" name="e_logo" placeholder="https://.../logo.png" />
                </div>
              </div>
            </div>

            <div class="grid cols-2">
              <div class="form-group">
                <label>Plano</label>
                <select class="select" [(ngModel)]="editForm.plan" name="e_plan">
                  <option value="FREE">FREE</option>
                  <option value="BASIC">BASIC (Essencial)</option>
                  <option value="PRO">PRO (Profissional)</option>
                  <option value="CLINIC">CLINIC (Clínica)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Status assinatura</label>
                <select class="select" [(ngModel)]="editForm.status" name="e_status">
                  <option value="PENDING">PENDING</option>
                  <option value="TRIAL">TRIAL</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAST_DUE">PAST_DUE</option>
                  <option value="CANCELED">CANCELED</option>
                </select>
              </div>
            </div>

            <div class="grid cols-2">
              <div class="form-group">
                <label>Mensalidade (R$)</label>
                <input class="input" type="number" min="0" step="0.01" [(ngModel)]="editForm.priceMonthlyBrl" name="e_price" />
              </div>
              <div class="form-group">
                <label>Moeda</label>
                <input class="input" [(ngModel)]="editForm.currency" name="e_cur" />
              </div>
            </div>

            <div class="grid cols-2">
              <div class="form-group">
                <label>Próxima renovação</label>
                <input class="input" type="datetime-local" [(ngModel)]="editForm.renewsAtLocal" name="e_renew" />
              </div>
              <div class="form-group">
                <label>Cancelada em (opcional)</label>
                <input class="input" type="datetime-local" [(ngModel)]="editForm.canceledAtLocal" name="e_can" />
              </div>
            </div>

            @if (editMessage) {
              <div style="font-size:13px;color:var(--muted);">{{ editMessage }}</div>
            }
            <div class="master-modal-actions">
              <button class="btn btn-primary" type="submit" [disabled]="saving">
                @if (saving) { <span class="spinner"></span> } {{ saving ? 'Salvando...' : 'Salvar alterações' }}
              </button>
              <button class="btn btn-ghost" type="button" (click)="editing=null">Fechar</button>
            </div>
          </form>

          <hr style="border:none;border-top:1px solid var(--border);margin:24px 0" />

          <section aria-labelledby="benefit-title">
            <div class="master-section-head">
              <div>
                <h4 id="benefit-title">Benefício e acesso especial</h4>
                <p>Conceda plano completo gratuito, temporário ou vitalício, sem depender da assinatura da Stripe.</p>
              </div>
              @if (isGrantActive(editing.accessGrant)) { <span class="badge badge-success">Ativo</span> }
            </div>

            @if (isGrantActive(editing.accessGrant)) {
              <div class="master-benefit-summary">
                <div><span>Plano concedido</span><strong>{{ editing.accessGrant?.plan }}</strong></div>
                <div><span>Dentistas</span><strong>{{ editing.accessGrant?.dentistLimit === null ? 'Ilimitados' : editing.accessGrant?.dentistLimit }}</strong></div>
                <div><span>Validade</span><strong>{{ editing.accessGrant?.expiresAt ? (editing.accessGrant?.expiresAt | date:'dd/MM/yyyy') : 'Vitalício' }}</strong></div>
                <div><span>Motivo</span><strong>{{ editing.accessGrant?.reason || 'Não informado' }}</strong></div>
              </div>
              <button type="button" class="btn btn-danger-outline btn-sm" (click)="revokeGrant()" [disabled]="grantSaving">
                {{ grantSaving ? 'Processando...' : revokeConfirm ? 'Confirmar revogação' : 'Revogar benefício' }}
              </button>
            } @else {
              <form class="form" (ngSubmit)="saveGrant()">
                <div class="grid cols-2">
                  <div class="form-group">
                    <label>Plano liberado</label>
                    <select class="select" [(ngModel)]="grantForm.plan" name="g_plan" (ngModelChange)="onGrantPlanChange($event)">
                      <option value="BASIC">Essencial</option><option value="PRO">Profissional</option><option value="CLINIC">Clínica completo</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Limite de dentistas</label>
                    <select class="select" [(ngModel)]="grantForm.limitMode" name="g_limit_mode">
                      <option value="PLAN">Padrão do plano</option><option value="CUSTOM">Personalizado</option><option value="UNLIMITED">Ilimitado</option>
                    </select>
                  </div>
                </div>
                @if (grantForm.limitMode === 'CUSTOM') {
                  <div class="form-group"><label>Quantidade de dentistas</label><input class="input" type="number" min="1" [(ngModel)]="grantForm.dentistLimit" name="g_limit" required /></div>
                }
                <div class="grid cols-2">
                  <div class="form-group">
                    <label>Validade</label>
                    <select class="select" [(ngModel)]="grantForm.duration" name="g_duration">
                      <option value="LIFETIME">Vitalício</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="CUSTOM">Data personalizada</option>
                    </select>
                  </div>
                  @if (grantForm.duration === 'CUSTOM') {
                    <div class="form-group"><label>Válido até</label><input class="input" type="datetime-local" [(ngModel)]="grantForm.expiresAtLocal" name="g_expires" required /></div>
                  }
                </div>
                <div class="form-group"><label>Motivo da concessão</label><textarea class="textarea" rows="2" [(ngModel)]="grantForm.reason" name="g_reason" placeholder="Parceria, cortesia comercial, cliente fundador..." required></textarea></div>
                <label class="master-check-row"><input type="checkbox" [(ngModel)]="grantForm.stopBilling" name="g_stop_billing" /><span>Interromper novas cobranças desta clínica. Se houver Stripe ativo, a renovação será cancelada.</span></label>
            @if (grantMessage) {
              <div class="master-inline-alert" [class.master-inline-alert--danger]="grantError" [class.master-inline-alert--success]="!grantError">{{ grantMessage }}</div>
            }
                <button type="submit" class="btn btn-primary" [disabled]="grantSaving">{{ grantSaving ? 'Concedendo...' : 'Conceder benefício' }}</button>
              </form>
            }
          </section>

          <hr style="border:none;border-top:1px solid var(--border);margin:24px 0" />

          <div style="margin-bottom:12px;">
            <h4 style="font-size:14px;font-weight:700;margin-bottom:4px;">Eventos de pagamento</h4>
            <p class="muted text-sm">Histórico de webhooks e processamento financeiro desta clínica.</p>
          </div>
          @if (eventsLoading) {
            <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin-bottom:12px;">
              <span class="spinner spinner-dark"></span>
              Carregando eventos...
            </div>
          } @else if (paymentEvents.length === 0) {
            <div style="font-size:13px;color:var(--muted);padding:10px 12px;background:var(--surface-2);border-radius:8px;margin-bottom:12px;">
              Nenhum evento de pagamento encontrado para esta clínica.
            </div>
          } @else {
            <div style="display:grid;gap:8px;margin-bottom:12px;max-height:220px;overflow:auto;">
              @for (ev of paymentEvents; track ev.id) {
                <div style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
                    <strong style="font-size:12px;">{{ ev.type }}</strong>
                    <span class="badge" [class.badge-success]="ev.status === 'PROCESSED'" [class.badge-danger]="ev.status === 'FAILED'" [class.badge-neutral]="ev.status !== 'PROCESSED' && ev.status !== 'FAILED'">
                      {{ ev.status }}
                    </span>
                  </div>
                  <div style="font-size:12px;color:var(--muted);">Recebido: {{ ev.receivedAt | date:'dd/MM/yyyy HH:mm' }}</div>
                  @if (ev.error) {
                    <div style="font-size:12px;color:var(--danger-text);margin-top:4px;">{{ ev.error }}</div>
                  }
                </div>
              }
            </div>
          }

          <hr style="border:none;border-top:1px solid var(--border);margin:20px 0 24px" />

          <div style="margin-bottom:12px;">
            <h4 style="font-size:14px;font-weight:700;margin-bottom:4px;">Redefinir senha do administrador</h4>
            <p class="muted text-sm">Altera o login do ADMIN desta clínica (hash Argon2).</p>
          </div>
          <form class="form" (ngSubmit)="resetPassword()">
            <div class="form-group">
              <label>E-mail admin <span class="muted" style="font-weight:400;">(opcional — usa o primeiro ADMIN se omitido)</span></label>
              <input class="input" [(ngModel)]="pwdForm.adminEmail" name="p_email" placeholder="admin@clinica.com" />
            </div>
            <div class="form-group">
              <label>Nova senha *</label>
              <div class="input-wrapper">
                <input class="input" [(ngModel)]="pwdForm.newPassword" name="p_new" [type]="showResetPassword ? 'text' : 'password'" minlength="8" required placeholder="Mínimo 8 caracteres" style="padding-right:42px;" />
                <button type="button" class="input-action" (click)="showResetPassword = !showResetPassword" [attr.aria-label]="showResetPassword ? 'Ocultar senha' : 'Mostrar senha'">
                  @if (showResetPassword) {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  } @else {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>Confirmar nova senha *</label>
              <div class="input-wrapper">
                <input class="input" [(ngModel)]="pwdForm.newPasswordConfirm" name="p_new_confirm" [type]="showResetPasswordConfirm ? 'text' : 'password'" minlength="8" required placeholder="Repita a senha" style="padding-right:42px;" />
                <button type="button" class="input-action" (click)="showResetPasswordConfirm = !showResetPasswordConfirm" [attr.aria-label]="showResetPasswordConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'">
                  @if (showResetPasswordConfirm) {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  } @else {
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              @if (pwdForm.newPasswordConfirm && pwdForm.newPassword !== pwdForm.newPasswordConfirm) {
                <small style="color:var(--danger-text);">As senhas não coincidem.</small>
              }
            </div>
            @if (pwdMessage) {
              <div style="font-size:13px;" [style.color]="pwdMessage.includes('atualizada') ? 'var(--success-text)' : 'var(--danger-text)'">{{ pwdMessage }}</div>
            }
            <button class="btn btn-danger-outline" type="submit" [disabled]="pwdSaving">
              @if (pwdSaving) { <span class="spinner spinner-dark" style="border-color:rgba(239,68,68,0.2);border-top-color:var(--danger);"></span> }
              Redefinir senha
            </button>
          </form>

          <hr style="border:none;border-top:1px solid var(--border);margin:24px 0" />

          <section style="border:1px solid #fecaca;border-radius:12px;padding:16px 18px;background:var(--danger-bg);">
            <h4 style="font-size:14px;font-weight:700;margin-bottom:4px;color:var(--danger-text);">Excluir clínica permanentemente</h4>
            <p class="text-sm" style="color:var(--danger-text);margin-bottom:14px;">
              Remove a clínica, sua assinatura e o banco de dados inteiro — pacientes, consultas, prontuários e financeiro. Não pode ser desfeito.
            </p>
            <div class="form-group">
              <label style="color:var(--danger-text);">Digite <strong>{{ editing.name }}</strong> para confirmar</label>
              <input class="input" [(ngModel)]="deleteConfirmText" name="delete_confirm" [ngModelOptions]="{standalone: true}" [placeholder]="editing.name" />
            </div>
            <button
              type="button"
              class="btn btn-danger"
              [disabled]="deleteSaving || deleteConfirmText.trim() !== editing.name.trim()"
              (click)="deleteClinicFinal()"
            >
              @if (deleteSaving) { <span class="spinner"></span> }
              {{ deleteSaving ? 'Excluindo...' : 'Excluir clínica permanentemente' }}
            </button>
          </section>
        </div>
      </div>
    }
  `
})
export class MasterCompaniesComponent implements OnInit {
  clinics: ClinicRow[] = []
  search = ''
  statusFilter: 'ALL' | 'ACTIVE' | 'BLOCKED' | 'BENEFIT' = 'ALL'
  editing: ClinicRow | null = null
  paymentEvents: PaymentEventRow[] = []
  eventsLoading = false
  readonly STATUS_CLASS = STATUS_CLASS
  editForm = {
    name: '',
    subdomain: '',
    internalNotes: '',
    primaryColor: '',
    logoUrl: '',
    plan: 'BASIC',
    status: 'ACTIVE',
    priceMonthlyBrl: 0,
    currency: 'BRL',
    renewsAtLocal: '',
    canceledAtLocal: ''
  }
  pwdForm = { adminEmail: '', newPassword: '', newPasswordConfirm: '' }
  showResetPassword = false
  showResetPasswordConfirm = false
  editMessage = ''
  pwdMessage = ''
  saving = false
  pwdSaving = false
  supportLoading = false
  grantSaving = false
  grantMessage = ''
  grantError = false
  revokeConfirm = false
  grantForm = this.emptyGrantForm()
  activeSaving = false
  deleteConfirmText = ''
  deleteSaving = false

  constructor(
    private readonly http: HttpClient,
    private readonly toast: ToastService,
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit() { this.load() }

  load() {
    this.http.get<ClinicRow[]>('/api/master/clinics').subscribe((res: ClinicRow[]) => {
      this.clinics = res
      if (this.editing) this.editing = res.find(item => item.id === this.editing?.id) || this.editing
    })
  }

  get filteredClinics() {
    const term = this.search.trim().toLowerCase()
    return this.clinics.filter(clinic => {
      const grantActive = this.isGrantActive(clinic.accessGrant)
      const status = clinic.subscription?.status || 'PENDING'
      const statusMatch =
        this.statusFilter === 'ALL' ||
        (this.statusFilter === 'BENEFIT' && grantActive) ||
        (this.statusFilter === 'ACTIVE' && clinic.active !== false && (grantActive || status === 'ACTIVE' || status === 'TRIAL')) ||
        (this.statusFilter === 'BLOCKED' && (clinic.active === false || (!grantActive && status !== 'ACTIVE' && status !== 'TRIAL')))
      const termMatch = !term || [clinic.name, clinic.subdomain, clinic.loginIdentities?.[0]?.email || ''].some(value => value.toLowerCase().includes(term))
      return statusMatch && termMatch
    })
  }

  openEdit(c: ClinicRow) {
    this.editing = c
    this.loadPaymentEvents(c.id)
    this.editMessage = ''
    this.pwdMessage = ''
    this.pwdForm = { adminEmail: '', newPassword: '', newPasswordConfirm: '' }
    this.showResetPassword = false
    this.showResetPasswordConfirm = false
    this.grantMessage = ''
    this.grantError = false
    this.revokeConfirm = false
    this.grantForm = this.emptyGrantForm()
    this.deleteConfirmText = ''
    this.deleteSaving = false
    const sub = c.subscription
    this.editForm = {
      name: c.name,
      subdomain: c.subdomain,
      internalNotes: c.internalNotes || '',
      primaryColor: c.primaryColor || '',
      logoUrl: c.logoUrl || '',
      plan: sub?.plan || 'BASIC',
      status: sub?.status || 'ACTIVE',
      priceMonthlyBrl: (sub?.priceCents ?? 0) / 100,
      currency: sub?.currency || 'BRL',
      renewsAtLocal: sub?.renewsAt ? this.toLocal(sub.renewsAt) : '',
      canceledAtLocal: sub?.canceledAt ? this.toLocal(sub.canceledAt) : ''
    }
  }

  isGrantActive(grant: ClinicRow['accessGrant']) {
    if (!grant?.active) return false
    return !grant.expiresAt || new Date(grant.expiresAt).getTime() > Date.now()
  }

  effectivePlan(clinic: ClinicRow) {
    return this.isGrantActive(clinic.accessGrant) ? clinic.accessGrant?.plan || '—' : clinic.subscription?.plan || '—'
  }

  clinicUrl(_clinic: ClinicRow) {
    return `${location.origin}/login`
  }

  startSupport() {
    if (!this.editing || this.supportLoading) return
    this.supportLoading = true
    this.http.post<any>(`/api/master/clinics/${this.editing.id}/support-session`, {}).subscribe({
      next: result => {
        this.supportLoading = false
        this.auth.setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user as User, tenant: result.tenant })
        localStorage.setItem('masterSupportSession', JSON.stringify({ clinicName: result.clinic?.name, userName: result.user?.name }))
        this.router.navigateByUrl('/app')
      },
      error: (error: any) => {
        this.supportLoading = false
        this.toast.error(error.error?.message || 'Não foi possível iniciar o acesso assistido.')
      }
    })
  }

  onGrantPlanChange(plan: string) {
    if (this.grantForm.limitMode === 'PLAN') this.grantForm.dentistLimit = plan === 'BASIC' ? 1 : plan === 'PRO' ? 3 : 1
  }

  saveGrant() {
    if (!this.editing || this.grantSaving) return
    this.grantMessage = ''
    this.grantError = false
    if (this.grantForm.reason.trim().length < 3) {
      this.grantError = true
      this.grantMessage = 'Informe o motivo do benefício.'
      return
    }
    const dentistLimit = this.grantForm.limitMode === 'UNLIMITED'
      ? null
      : this.grantForm.limitMode === 'CUSTOM'
        ? Number(this.grantForm.dentistLimit)
        : this.grantForm.plan === 'BASIC' ? 1 : this.grantForm.plan === 'PRO' ? 3 : null
    let expiresAt: string | null = null
    if (this.grantForm.duration === 'CUSTOM') {
      const custom = new Date(this.grantForm.expiresAtLocal)
      if (Number.isNaN(custom.getTime())) { this.grantError = true; this.grantMessage = 'Informe uma validade correta.'; return }
      expiresAt = custom.toISOString()
    } else if (this.grantForm.duration !== 'LIFETIME') {
      expiresAt = new Date(Date.now() + Number(this.grantForm.duration) * 24 * 60 * 60 * 1000).toISOString()
    }
    this.grantSaving = true
    this.http.post<any>(`/api/master/clinics/${this.editing.id}/access-grant`, {
      plan: this.grantForm.plan,
      dentistLimit,
      reason: this.grantForm.reason.trim(),
      expiresAt,
      stopBilling: this.grantForm.stopBilling
    }).subscribe({
      next: result => {
        this.grantSaving = false
        if (this.editing) this.editing.accessGrant = result.grant
        this.grantMessage = 'Benefício concedido com sucesso.'
        this.toast.success('Benefício de acesso ativado')
        this.load()
      },
      error: (error: any) => {
        this.grantSaving = false
        this.grantError = true
        this.grantMessage = error.error?.message || 'Não foi possível conceder o benefício.'
      }
    })
  }

  revokeGrant() {
    if (!this.editing || this.grantSaving) return
    if (!this.revokeConfirm) { this.revokeConfirm = true; return }
    this.grantSaving = true
    this.http.post<any>(`/api/master/clinics/${this.editing.id}/access-grant/revoke`, {}).subscribe({
      next: result => {
        this.grantSaving = false
        this.revokeConfirm = false
        if (this.editing) this.editing.accessGrant = result.grant
        this.toast.success('Benefício revogado')
        this.load()
      },
      error: (error: any) => {
        this.grantSaving = false
        this.revokeConfirm = false
        this.toast.error(error.error?.message || 'Não foi possível revogar o benefício.')
      }
    })
  }

  toggleActive() {
    if (!this.editing || this.activeSaving) return
    const next = this.editing.active === false
    this.activeSaving = true
    this.http.patch<{ tenant: ClinicRow }>(`/api/master/clinics/${this.editing.id}/active`, { active: next }).subscribe({
      next: result => {
        this.activeSaving = false
        if (this.editing) this.editing.active = result.tenant.active
        this.toast.success(next ? 'Clínica reativada' : 'Clínica inativada')
        this.load()
      },
      error: (error: any) => {
        this.activeSaving = false
        this.toast.error(error.error?.message || 'Não foi possível atualizar o status da clínica.')
      }
    })
  }

  deleteClinicFinal() {
    if (!this.editing || this.deleteSaving) return
    if (this.deleteConfirmText.trim() !== this.editing.name.trim()) return
    this.deleteSaving = true
    const id = this.editing.id
    this.http.delete(`/api/master/clinics/${id}`, { body: { confirmName: this.deleteConfirmText.trim() } }).subscribe({
      next: () => {
        this.deleteSaving = false
        this.toast.success('Clínica excluída permanentemente')
        this.editing = null
        this.deleteConfirmText = ''
        this.load()
      },
      error: (error: any) => {
        this.deleteSaving = false
        this.toast.error(error.error?.message || 'Não foi possível excluir a clínica.')
      }
    })
  }

  private emptyGrantForm() {
    return { plan: 'CLINIC', limitMode: 'UNLIMITED', dentistLimit: 3, duration: 'LIFETIME', expiresAtLocal: '', reason: '', stopBilling: true }
  }

  private toLocal(iso: string) {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  private fromLocal(v: string) {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  saveEdit() {
    if (!this.editing) return
    this.editMessage = ''
    this.saving = true
    const body = {
      name: this.editForm.name,
      subdomain: this.editForm.subdomain,
      internalNotes: this.editForm.internalNotes || null,
      primaryColor: this.editForm.primaryColor.trim(),
      logoUrl: this.editForm.logoUrl.trim(),
      plan: this.editForm.plan,
      status: this.editForm.status,
      priceMonthlyBrl: Number(this.editForm.priceMonthlyBrl),
      currency: this.editForm.currency,
      renewsAt: this.fromLocal(this.editForm.renewsAtLocal),
      canceledAt: this.fromLocal(this.editForm.canceledAtLocal)
    }
    this.http.patch(`/api/master/clinics/${this.editing.id}`, body).subscribe({
      next: () => {
        this.saving = false
        this.editMessage = 'Salvo com sucesso.'
        this.toast.success('Empresa atualizada')
        this.load()
      },
      error: (err: any) => { this.saving = false; this.editMessage = err.error?.message || 'Erro ao salvar' }
    })
  }

  resetPassword() {
    if (!this.editing) return
    this.pwdMessage = ''
    if (this.pwdForm.newPassword !== this.pwdForm.newPasswordConfirm) {
      this.pwdMessage = 'As senhas não coincidem.'
      return
    }
    this.pwdSaving = true
    const body: { newPassword: string; adminEmail?: string } = { newPassword: this.pwdForm.newPassword }
    if (this.pwdForm.adminEmail.trim()) body.adminEmail = this.pwdForm.adminEmail.trim()
    this.http.post(`/api/master/clinics/${this.editing.id}/admin/reset-password`, body).subscribe({
      next: (res: any) => {
        this.pwdSaving = false
        this.pwdMessage = res?.message || 'Senha atualizada com sucesso.'
        this.pwdForm.newPassword = ''
        this.pwdForm.newPasswordConfirm = ''
        this.showResetPassword = false
        this.showResetPasswordConfirm = false
        this.toast.success('Senha redefinida com sucesso')
      },
      error: (err: any) => { this.pwdSaving = false; this.pwdMessage = err.error?.message || 'Falha ao redefinir' }
    })
  }

  private loadPaymentEvents(tenantId: string) {
    this.eventsLoading = true
    this.http.get<PaymentEventRow[]>(`/api/master/payments/events?tenantId=${encodeURIComponent(tenantId)}`).subscribe({
      next: rows => {
        this.eventsLoading = false
        this.paymentEvents = rows
      },
      error: () => {
        this.eventsLoading = false
        this.paymentEvents = []
      }
    })
  }

  closeOnBackdrop(ev: MouseEvent) {
    if ((ev.target as HTMLElement).classList.contains('master-modal-backdrop')) this.editing = null
  }
}
