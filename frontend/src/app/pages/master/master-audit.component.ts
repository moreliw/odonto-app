import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { PaginationComponent } from '../../components/pagination/pagination.component'
import { paginate } from '../../utils/pagination'

type ClinicOption = { id: string; name: string }
type AuditRow = {
  id: string
  actorEmail: string
  action: string
  tenantId?: string | null
  tenantName?: string | null
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  MASTER_LOGIN: 'Login master',
  CLINIC_CREATED: 'Clínica criada',
  CLINIC_UPDATED: 'Clínica atualizada',
  CLINIC_LOGO_UPDATED: 'Logo da clínica atualizada',
  CLINIC_LOGO_REMOVED: 'Logo da clínica removida',
  TENANT_ADMIN_PASSWORD_RESET: 'Senha do administrador redefinida',
  TENANT_USER_CREATED: 'Usuário criado',
  TENANT_USER_UPDATED: 'Usuário atualizado',
  SUPPORT_SESSION_CREATED: 'Acesso assistido iniciado',
  ACCESS_GRANT_CREATED: 'Benefício concedido',
  ACCESS_GRANT_REVOKED: 'Benefício revogado'
}

@Component({
  selector: 'app-master-audit',
  imports: [CommonModule, FormsModule, PaginationComponent],
  template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div class="page-header-left"><h1>Auditoria</h1><p>Histórico das ações críticas realizadas no painel master.</p></div>
        <div class="page-header-actions"><button type="button" class="btn btn-outline btn-sm" (click)="load()">Atualizar</button></div>
      </div>
      <div class="card master-filter-card">
        <div class="master-filter-grid master-filter-grid--audit">
          <div class="form-group">
            <label for="audit-clinic">Clínica</label>
            <select id="audit-clinic" class="select" [(ngModel)]="tenantId" (ngModelChange)="load()">
              <option value="">Todas as clínicas</option>
              @for (clinic of clinics; track clinic.id) { <option [value]="clinic.id">{{ clinic.name }}</option> }
            </select>
          </div>
          <div class="form-group">
            <label for="audit-action">Ação</label>
            <input id="audit-action" class="input" [(ngModel)]="action" (keyup.enter)="load()" placeholder="Ex.: USER, GRANT, LOGIN" />
          </div>
        </div>
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="table-wrapper">
          <table class="table">
            <thead><tr><th>Data</th><th>Ação</th><th>Clínica</th><th>Responsável</th><th>Alvo</th><th>Detalhes</th></tr></thead>
            <tbody>
              @if (loading) { <tr><td colspan="6" class="table-empty"><span class="spinner spinner-dark"></span></td></tr> }
              @else if (rows.length === 0) { <tr><td colspan="6" class="table-empty">Nenhuma ação registrada para os filtros selecionados.</td></tr> }
              @for (row of pagedRows; track row.id) {
                <tr>
                  <td class="muted text-sm">{{ row.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</td>
                  <td><strong>{{ label(row.action) }}</strong><small class="master-code-label">{{ row.action }}</small></td>
                  <td>{{ row.tenantName || 'Plataforma' }}</td>
                  <td class="muted text-sm">{{ row.actorEmail }}</td>
                  <td class="muted text-sm">{{ row.targetType || '—' }}{{ row.targetId ? ' · ' + shortId(row.targetId) : '' }}</td>
                  <td><span class="master-audit-metadata">{{ metadata(row.metadata) }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="page" [pageSize]="pageSize" [totalItems]="rows.length" (pageChange)="page=$event"></app-pagination>
      </div>
    </div>
  `
})
export class MasterAuditComponent implements OnInit {
  clinics: ClinicOption[] = []
  rows: AuditRow[] = []
  tenantId = ''
  action = ''
  loading = false
  page = 1
  readonly pageSize = 20

  constructor(private readonly http: HttpClient) {}
  ngOnInit() {
    this.http.get<ClinicOption[]>('/api/master/clinics').subscribe(clinics => this.clinics = clinics)
    this.load()
  }
  load() {
    this.page = 1
    this.loading = true
    const params = new URLSearchParams({ take: '200' })
    if (this.tenantId) params.set('tenantId', this.tenantId)
    if (this.action.trim()) params.set('action', this.action.trim())
    this.http.get<AuditRow[]>(`/api/master/audit?${params}`).subscribe({
      next: rows => { this.loading = false; this.rows = rows },
      error: () => { this.loading = false; this.rows = [] }
    })
  }
  get pagedRows() { return paginate(this.rows, this.page, this.pageSize) }
  label(action: string) { return ACTION_LABELS[action] || action }
  shortId(id: string) { return id.length > 12 ? `${id.slice(0, 8)}…` : id }
  metadata(value: Record<string, unknown> | null | undefined) {
    if (!value || Object.keys(value).length === 0) return '—'
    return Object.entries(value).slice(0, 4).map(([key, item]) => `${key}: ${this.value(item)}`).join(' · ')
  }
  private value(item: unknown) {
    if (item === null || item === undefined) return '—'
    if (Array.isArray(item)) return item.join(', ')
    if (typeof item === 'object') return JSON.stringify(item)
    return String(item)
  }
}
