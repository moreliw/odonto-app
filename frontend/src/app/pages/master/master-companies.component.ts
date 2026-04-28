import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { ToastService } from '../../services/toast.service'

type ClinicRow = {
  id: string; name: string; subdomain: string; slug: string; internalNotes?: string | null
  subscription?: { plan: string; status: string; priceCents: number; currency: string; renewsAt?: string | null; canceledAt?: string | null } | null
  loginIdentities?: { email: string }[]
}

const STATUS_CLASS: Record<string, string> = { ACTIVE: '', TRIAL: 'pending', PAST_DUE: 'late', CANCELED: 'neutral' }

@Component({
  selector: 'app-master-companies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Empresas</h1>
          <p>Gerencie plano, cobrança, status e redefinição de senha das clínicas</p>
        </div>
        <div class="page-header-actions">
          <span class="badge badge-neutral">{{ clinics.length }} empresa{{ clinics.length !== 1 ? 's' : '' }}</span>
          <button type="button" class="btn btn-outline btn-sm" (click)="load()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Atualizar
          </button>
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
              @for (c of clinics; track c.id) {
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div class="avatar" style="background:var(--primary-100);color:var(--primary-600);font-size:13px;">{{ c.name[0].toUpperCase() }}</div>
                      <strong>{{ c.name }}</strong>
                    </div>
                  </td>
                  <td class="muted text-sm">{{ c.subdomain }}</td>
                  <td>
                    <span class="badge" [class.badge-blue]="c.subscription?.plan === 'PRO'" [class.badge-neutral]="c.subscription?.plan !== 'PRO'">
                      {{ c.subscription?.plan || '—' }}
                    </span>
                  </td>
                  <td>
                    <span class="status-chip" [class]="STATUS_CLASS[c.subscription?.status || ''] || ''">
                      {{ c.subscription?.status || '—' }}
                    </span>
                  </td>
                  <td class="text-sm">R$ {{ ((c.subscription?.priceCents || 0) / 100) | number:'1.2-2' }}</td>
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
        <div class="master-modal" (click)="$event.stopPropagation()">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;">
            <div>
              <h3>{{ editing.name }}</h3>
              <p class="muted text-sm">ID: {{ editing.id }} · slug: {{ editing.slug }}</p>
            </div>
            <button class="btn btn-icon btn-sm" (click)="editing=null" aria-label="Fechar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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

            <div class="grid cols-2">
              <div class="form-group">
                <label>Plano</label>
                <select class="select" [(ngModel)]="editForm.plan" name="e_plan">
                  <option value="BASIC">BASIC</option>
                  <option value="PRO">PRO</option>
                </select>
              </div>
              <div class="form-group">
                <label>Status assinatura</label>
                <select class="select" [(ngModel)]="editForm.status" name="e_status">
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
              <input class="input" [(ngModel)]="pwdForm.newPassword" name="p_new" type="password" placeholder="Mínimo 8 caracteres" />
            </div>
            @if (pwdMessage) {
              <div style="font-size:13px;" [style.color]="pwdMessage.includes('atualizada') ? 'var(--success-text)' : 'var(--danger-text)'">{{ pwdMessage }}</div>
            }
            <button class="btn btn-danger-outline" type="submit" [disabled]="pwdSaving">
              @if (pwdSaving) { <span class="spinner spinner-dark" style="border-color:rgba(239,68,68,0.2);border-top-color:var(--danger);"></span> }
              Redefinir senha
            </button>
          </form>
        </div>
      </div>
    }
  `
})
export class MasterCompaniesComponent implements OnInit {
  clinics: ClinicRow[] = []
  editing: ClinicRow | null = null
  readonly STATUS_CLASS = STATUS_CLASS
  editForm = {
    name: '',
    subdomain: '',
    internalNotes: '',
    plan: 'BASIC',
    status: 'ACTIVE',
    priceMonthlyBrl: 0,
    currency: 'BRL',
    renewsAtLocal: '',
    canceledAtLocal: ''
  }
  pwdForm = { adminEmail: '', newPassword: '' }
  editMessage = ''
  pwdMessage = ''
  saving = false
  pwdSaving = false

  constructor(private readonly http: HttpClient, private toast: ToastService) {}

  ngOnInit() { this.load() }

  load() {
    this.http.get<ClinicRow[]>('/api/master/clinics').subscribe((res: ClinicRow[]) => this.clinics = res)
  }

  openEdit(c: ClinicRow) {
    this.editing = c
    this.editMessage = ''
    this.pwdMessage = ''
    this.pwdForm = { adminEmail: '', newPassword: '' }
    const sub = c.subscription
    this.editForm = {
      name: c.name,
      subdomain: c.subdomain,
      internalNotes: c.internalNotes || '',
      plan: sub?.plan || 'BASIC',
      status: sub?.status || 'ACTIVE',
      priceMonthlyBrl: (sub?.priceCents ?? 0) / 100,
      currency: sub?.currency || 'BRL',
      renewsAtLocal: sub?.renewsAt ? this.toLocal(sub.renewsAt) : '',
      canceledAtLocal: sub?.canceledAt ? this.toLocal(sub.canceledAt) : ''
    }
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
    this.pwdSaving = true
    const body: { newPassword: string; adminEmail?: string } = { newPassword: this.pwdForm.newPassword }
    if (this.pwdForm.adminEmail.trim()) body.adminEmail = this.pwdForm.adminEmail.trim()
    this.http.post(`/api/master/clinics/${this.editing.id}/admin/reset-password`, body).subscribe({
      next: (res: any) => {
        this.pwdSaving = false
        this.pwdMessage = res?.message || 'Senha atualizada com sucesso.'
        this.pwdForm.newPassword = ''
        this.toast.success('Senha redefinida com sucesso')
      },
      error: (err: any) => { this.pwdSaving = false; this.pwdMessage = err.error?.message || 'Falha ao redefinir' }
    })
  }

  closeOnBackdrop(ev: MouseEvent) {
    if ((ev.target as HTMLElement).classList.contains('master-modal-backdrop')) this.editing = null
  }
}
