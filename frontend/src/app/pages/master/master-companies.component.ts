import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'

type ClinicRow = {
  id: string
  name: string
  subdomain: string
  slug: string
  internalNotes?: string | null
  subscription?: {
    plan: string
    status: string
    priceCents: number
    currency: string
    renewsAt?: string | null
    canceledAt?: string | null
  } | null
  loginIdentities?: { email: string }[]
}

@Component({
  selector: 'app-master-companies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-page">
      <div class="table-title-row">
        <div>
          <h1 style="margin:0;font-size:22px;">Empresas</h1>
          <p class="muted" style="margin:6px 0 0;">Plano, cobrança, status e notas internas. Redefinição de senha do admin da clínica.</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="load()">Atualizar</button>
      </div>

      <section class="card mt-4 table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Subdomínio</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Mensalidade</th>
              <th>Admin (login)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of clinics">
              <td><strong>{{ c.name }}</strong></td>
              <td>{{ c.subdomain }}</td>
              <td>{{ c.subscription?.plan || '—' }}</td>
              <td>
                <span class="status-chip" [class.pending]="c.subscription?.status === 'TRIAL'" [class.late]="c.subscription?.status === 'PAST_DUE'">
                  {{ c.subscription?.status || '—' }}
                </span>
              </td>
              <td>R$ {{ ((c.subscription?.priceCents || 0) / 100) | number : '1.2-2' }} {{ c.subscription?.currency || '' }}</td>
              <td class="muted">{{ c.loginIdentities?.[0]?.email || '—' }}</td>
              <td><button type="button" class="btn btn-outline" (click)="openEdit(c)">Gerenciar</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <div class="master-modal-backdrop" *ngIf="editing" (click)="closeOnBackdrop($event)">
      <div class="master-modal" (click)="$event.stopPropagation()">
        <h3>{{ editing.name }}</h3>
        <p class="muted">ID {{ editing.id }} · slug {{ editing.slug }}</p>

        <form class="form mt-3" (ngSubmit)="saveEdit()">
          <label>Nome</label>
          <input class="input" [(ngModel)]="editForm.name" name="e_name" required />

          <label>Subdomínio</label>
          <input class="input" [(ngModel)]="editForm.subdomain" name="e_sub" required />

          <label>Notas internas (só super admin)</label>
          <textarea class="textarea" [(ngModel)]="editForm.internalNotes" name="e_notes" placeholder="Contrato, observações comerciais…"></textarea>

          <div class="grid cols-2">
            <div>
              <label>Plano</label>
              <select class="select" [(ngModel)]="editForm.plan" name="e_plan">
                <option value="BASIC">BASIC</option>
                <option value="PRO">PRO</option>
              </select>
            </div>
            <div>
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
            <div>
              <label>Preço (centavos)</label>
              <input class="input" type="number" min="0" step="100" [(ngModel)]="editForm.priceCents" name="e_price" />
            </div>
            <div>
              <label>Moeda</label>
              <input class="input" [(ngModel)]="editForm.currency" name="e_cur" />
            </div>
          </div>

          <div class="grid cols-2">
            <div>
              <label>Próxima renovação</label>
              <input class="input" type="datetime-local" [(ngModel)]="editForm.renewsAtLocal" name="e_renew" />
            </div>
            <div>
              <label>Cancelada em (opcional)</label>
              <input class="input" type="datetime-local" [(ngModel)]="editForm.canceledAtLocal" name="e_can" />
            </div>
          </div>

          <p *ngIf="editMessage" class="muted">{{ editMessage }}</p>
          <div class="master-modal-actions">
            <button class="btn btn-primary" type="submit" [disabled]="saving">{{ saving ? 'Salvando…' : 'Salvar alterações' }}</button>
            <button class="btn btn-outline" type="button" (click)="editing = null">Fechar</button>
          </div>
        </form>

        <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />

        <h4 style="margin:0 0 8px;font-size:15px;">Redefinir senha do administrador da clínica</h4>
        <p class="muted" style="font-size:13px;margin:0 0 12px;">Altera o login ADMIN no banco desta empresa (Argon2).</p>
        <form class="form" (ngSubmit)="resetPassword()">
          <input class="input" [(ngModel)]="pwdForm.adminEmail" name="p_email" placeholder="E-mail admin (opcional, padrão: primeiro ADMIN)" />
          <input class="input" [(ngModel)]="pwdForm.newPassword" name="p_new" type="password" placeholder="Nova senha (mín. 8)" />
          <button class="btn btn-danger" type="submit" [disabled]="pwdSaving">{{ pwdSaving ? 'Aplicando…' : 'Redefinir senha' }}</button>
          <p *ngIf="pwdMessage" class="muted mt-2">{{ pwdMessage }}</p>
        </form>
      </div>
    </div>
  `
})
export class MasterCompaniesComponent implements OnInit {
  clinics: ClinicRow[] = []
  editing: ClinicRow | null = null
  editForm = {
    name: '',
    subdomain: '',
    internalNotes: '',
    plan: 'BASIC',
    status: 'ACTIVE',
    priceCents: 0,
    currency: 'BRL',
    renewsAtLocal: '',
    canceledAtLocal: ''
  }
  pwdForm = { adminEmail: '', newPassword: '' }
  editMessage = ''
  pwdMessage = ''
  saving = false
  pwdSaving = false

  constructor(private readonly http: HttpClient) {}

  ngOnInit() {
    this.load()
  }

  load() {
    this.http.get<ClinicRow[]>('/api/master/clinics').subscribe(res => (this.clinics = res))
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
      plan: (sub?.plan as string) || 'BASIC',
      status: (sub?.status as string) || 'ACTIVE',
      priceCents: sub?.priceCents ?? 0,
      currency: sub?.currency || 'BRL',
      renewsAtLocal: sub?.renewsAt ? this.toLocalInput(sub.renewsAt) : '',
      canceledAtLocal: sub?.canceledAt ? this.toLocalInput(sub.canceledAt) : ''
    }
  }

  private toLocalInput(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  private fromLocalInput(v: string) {
    if (!v) return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
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
      priceCents: Number(this.editForm.priceCents),
      currency: this.editForm.currency,
      renewsAt: this.fromLocalInput(this.editForm.renewsAtLocal),
      canceledAt: this.fromLocalInput(this.editForm.canceledAtLocal)
    }
    this.http.patch(`/api/master/clinics/${this.editing.id}`, body).subscribe({
      next: () => {
        this.saving = false
        this.editMessage = 'Salvo.'
        this.load()
      },
      error: err => {
        this.saving = false
        this.editMessage = err.error?.message || 'Erro ao salvar'
      }
    })
  }

  resetPassword() {
    if (!this.editing) return
    this.pwdMessage = ''
    this.pwdSaving = true
    const body: { newPassword: string; adminEmail?: string } = { newPassword: this.pwdForm.newPassword }
    if (this.pwdForm.adminEmail.trim()) body.adminEmail = this.pwdForm.adminEmail.trim()
    this.http.post(`/api/master/clinics/${this.editing.id}/admin/reset-password`, body).subscribe({
      next: res => {
        this.pwdSaving = false
        this.pwdMessage = (res as any)?.message || 'Senha atualizada.'
        this.pwdForm.newPassword = ''
      },
      error: err => {
        this.pwdSaving = false
        this.pwdMessage = err.error?.message || 'Falha ao redefinir'
      }
    })
  }

  closeOnBackdrop(ev: MouseEvent) {
    if ((ev.target as HTMLElement).classList.contains('master-modal-backdrop')) this.editing = null
  }
}
