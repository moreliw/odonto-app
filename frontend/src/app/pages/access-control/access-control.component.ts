import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import { AccessConfiguration, PermissionKey } from '../../models/access-control.model'
import { ToastService } from '../../services/toast.service'

type AccessRole = 'USER' | 'DENTIST'
type AccessModule = {
  id: string
  title: string
  description: string
  icon: string
  view: PermissionKey
  manage?: PermissionKey
}

@Component({
  selector: 'app-access-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './access-control.component.html',
  styleUrl: './access-control.component.css'
})
export class AccessControlComponent implements OnInit {
  loading = true
  saving = ''
  activeView: 'profiles' | 'users' = 'profiles'
  config: AccessConfiguration | null = null
  selectedRole: AccessRole = 'USER'
  selectedUserId = ''
  roleDraft: Record<AccessRole, Set<PermissionKey>> = { USER: new Set(), DENTIST: new Set() }
  userDraft: Partial<Record<PermissionKey, boolean>> = {}

  readonly modules: AccessModule[] = [
    { id:'dashboard', title:'Dashboard', description:'Indicadores e visão geral da clínica.', icon:'⌂', view:'DASHBOARD_VIEW' },
    { id:'appointments', title:'Agenda', description:'Consultas, confirmações e horários.', icon:'▣', view:'APPOINTMENTS_VIEW', manage:'APPOINTMENTS_MANAGE' },
    { id:'patients', title:'Pacientes', description:'Cadastro e ficha completa dos pacientes.', icon:'○', view:'PATIENTS_VIEW', manage:'PATIENTS_MANAGE' },
    { id:'records', title:'Prontuário', description:'Evoluções, odontograma, arquivos e tratamentos.', icon:'▤', view:'RECORDS_VIEW', manage:'RECORDS_MANAGE' },
    { id:'finance', title:'Financeiro', description:'Cobranças, recebimentos, despesas e serviços.', icon:'$', view:'FINANCE_VIEW', manage:'FINANCE_MANAGE' },
    { id:'team', title:'Equipe', description:'Profissionais e contas de acesso da clínica.', icon:'◇', view:'TEAM_VIEW', manage:'TEAM_MANAGE' }
  ]

  constructor(private readonly http: HttpClient, private readonly toast: ToastService) {}

  ngOnInit() { this.load() }

  get selectedUser() { return this.config?.users.find(user => user.id === this.selectedUserId) || null }
  get selectedRoleLabel() { return this.selectedRole === 'USER' ? 'Equipe de apoio' : 'Dentista' }
  get overrideCount() { return Object.keys(this.userDraft).length }

  load() {
    this.loading = true
    this.http.get<AccessConfiguration>('/api/access-control').subscribe({
      next: config => {
        this.config = config
        for (const profile of config.profiles) this.roleDraft[profile.role] = new Set(profile.permissions)
        this.selectedUserId = config.users[0]?.id || ''
        this.loadUserDraft()
        this.loading = false
      },
      error: () => { this.loading = false; this.toast.error('Não foi possível carregar as permissões') }
    })
  }

  roleHas(permission: PermissionKey) { return this.roleDraft[this.selectedRole].has(permission) }
  toggleRole(permission: PermissionKey, enabled: boolean) {
    const draft = this.roleDraft[this.selectedRole]
    if (enabled) draft.add(permission)
    else draft.delete(permission)
    const module = this.modules.find(item => item.view === permission || item.manage === permission)
    if (!module) return
    if (module.manage === permission && enabled) draft.add(module.view)
    if (module.view === permission && !enabled && module.manage) draft.delete(module.manage)
    this.roleDraft = { ...this.roleDraft, [this.selectedRole]:new Set(draft) }
  }

  async saveRole() {
    const role = this.selectedRole
    this.saving = `role-${role}`
    try {
      const result = await firstValueFrom(this.http.put<{permissions:PermissionKey[]}>(`/api/access-control/roles/${role}`, { permissions:[...this.roleDraft[role]] }))
      this.roleDraft[role] = new Set(result.permissions)
      this.roleDraft = { ...this.roleDraft }
      this.toast.success(`Permissões de ${this.selectedRoleLabel.toLowerCase()} atualizadas`)
      await this.reloadConfiguration()
    } catch (error: any) { this.toast.error('Não foi possível salvar as permissões', error?.error?.message) }
    finally { this.saving = '' }
  }

  selectUser(id: string) { this.selectedUserId = id; this.loadUserDraft() }
  overrideState(permission: PermissionKey): 'inherit' | 'allow' | 'deny' {
    const value = this.userDraft[permission]
    return value === true ? 'allow' : value === false ? 'deny' : 'inherit'
  }
  setOverride(permission: PermissionKey, state: 'inherit' | 'allow' | 'deny') {
    if (state === 'inherit') delete this.userDraft[permission]
    else this.userDraft[permission] = state === 'allow'
    this.userDraft = { ...this.userDraft }
  }
  setModuleOverride(module: AccessModule, permission: PermissionKey, state: 'inherit' | 'allow' | 'deny') {
    this.setOverride(permission, state)
    if (permission === module.view && state === 'deny' && module.manage) this.setOverride(module.manage, 'deny')
    if (permission === module.manage && state === 'allow') this.setOverride(module.view, 'allow')
  }
  inheritedHas(permission: PermissionKey) {
    const user = this.selectedUser
    return user ? this.roleDraft[user.role].has(permission) : false
  }
  effectiveHas(permission: PermissionKey) {
    const override = this.userDraft[permission]
    return override === undefined ? this.inheritedHas(permission) : override
  }

  async saveUser() {
    if (!this.selectedUserId) return
    this.saving = `user-${this.selectedUserId}`
    try {
      await firstValueFrom(this.http.put(`/api/access-control/users/${this.selectedUserId}`, { overrides:this.userDraft }))
      this.toast.success('Exceções do usuário atualizadas')
      await this.reloadConfiguration()
    } catch (error: any) { this.toast.error('Não foi possível salvar as exceções', error?.error?.message) }
    finally { this.saving = '' }
  }

  private loadUserDraft() { this.userDraft = { ...(this.selectedUser?.overrides || {}) } }
  private async reloadConfiguration() {
    const selected = this.selectedUserId
    const config = await firstValueFrom(this.http.get<AccessConfiguration>('/api/access-control'))
    this.config = config
    for (const profile of config.profiles) this.roleDraft[profile.role] = new Set(profile.permissions)
    this.selectedUserId = config.users.some(user => user.id === selected) ? selected : config.users[0]?.id || ''
    this.loadUserDraft()
  }
}
