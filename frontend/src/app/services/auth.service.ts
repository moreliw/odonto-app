import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { BehaviorSubject, Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs'
import { AccessSnapshot, DEFAULT_PERMISSIONS, PermissionKey } from '../models/access-control.model'

export type User = { id: string; username?: string | null; email: string; name: string; role: 'ADMIN' | 'USER' | 'DENTIST' }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken$ = new BehaviorSubject<string | null>(null)
  private refreshToken: string | null = null
  private user$ = new BehaviorSubject<User | null>(null)
  private access$ = new BehaviorSubject<AccessSnapshot | null>(null)
  private accessLoaded = false
  private accessRequest$: Observable<AccessSnapshot> | null = null
  constructor(private http: HttpClient) {
    const acc = localStorage.getItem('accessToken')
    const ref = localStorage.getItem('refreshToken')
    const usr = localStorage.getItem('user')
    this.accessToken$.next(acc)
    this.refreshToken = ref
    this.user$.next(usr ? JSON.parse(usr) : null)
    const storedAccess = localStorage.getItem('accessPermissions')
    if (storedAccess) {
      try { this.access$.next(JSON.parse(storedAccess) as AccessSnapshot) }
      catch { localStorage.removeItem('accessPermissions') }
    }
  }
  login(identifier: string, password: string) {
    return this.http.post<{ accessToken: string; refreshToken: string; user: User; subdomain?: string; tenant?: string }>(`/api/public/login`, { identifier, password }).pipe(
      tap(res => {
        this.accessToken$.next(res.accessToken)
        this.refreshToken = res.refreshToken
        this.user$.next(res.user)
        this.resetAccess(res.user)
        localStorage.setItem('accessToken', res.accessToken)
        localStorage.setItem('refreshToken', res.refreshToken)
        localStorage.setItem('user', JSON.stringify(res.user))
        const tenantSub = res.subdomain || res.tenant
        if (tenantSub) localStorage.setItem('tenant', tenantSub)
      })
    )
  }
  /** Usado pelo login automático após o cadastro: mesma persistência do login manual, sem chamar a API de novo. */
  setSession(res: { accessToken: string; refreshToken: string; user: User; tenant?: string }) {
    this.accessToken$.next(res.accessToken)
    this.refreshToken = res.refreshToken
    this.user$.next(res.user)
    this.resetAccess(res.user)
    localStorage.setItem('accessToken', res.accessToken)
    localStorage.setItem('refreshToken', res.refreshToken)
    localStorage.setItem('user', JSON.stringify(res.user))
    if (res.tenant) localStorage.setItem('tenant', res.tenant)
  }

  getAccessToken() {
    return this.accessToken$.value
  }
  refresh() {
    if (!this.refreshToken) return of({ accessToken: '' })
    return this.http.post<{ accessToken: string }>(`/api/auth/refresh`, { token: this.refreshToken }).pipe(
      tap(res => {
        if (res.accessToken) {
          this.accessToken$.next(res.accessToken)
          localStorage.setItem('accessToken', res.accessToken)
        }
      })
    )
  }
  getUser() {
    return this.user$.value
  }
  accessChanges() { return this.access$.asObservable() }
  hasPermission(permission: PermissionKey) {
    const user = this.user$.value
    if (!user) return false
    if (user.role === 'ADMIN') return true
    const current = this.access$.value
    const permissions = current?.role === user.role ? current.permissions : DEFAULT_PERMISSIONS[user.role]
    return permissions.includes(permission)
  }
  ensurePermissions(force = false): Observable<AccessSnapshot> {
    const user = this.user$.value
    if (!user) return of({ role: 'USER', permissions: [] })
    if (!force && this.accessLoaded && this.access$.value) return of(this.access$.value)
    if (!force && this.accessRequest$) return this.accessRequest$
    const fallback: AccessSnapshot = { role: user.role, permissions: [...DEFAULT_PERMISSIONS[user.role]] }
    this.accessRequest$ = this.http.get<AccessSnapshot>('/api/access-control/me').pipe(
      catchError(() => of(fallback)),
      tap(access => {
        this.accessLoaded = true
        this.access$.next(access)
        localStorage.setItem('accessPermissions', JSON.stringify(access))
      }),
      finalize(() => { this.accessRequest$ = null }),
      shareReplay(1)
    )
    return this.accessRequest$
  }
  /** Atualiza o usuário em cache (ex.: após editar o próprio perfil) sem exigir novo login. */
  patchUser(patch: Partial<User>) {
    const current = this.user$.value
    if (!current) return
    const updated = { ...current, ...patch }
    this.user$.next(updated)
    localStorage.setItem('user', JSON.stringify(updated))
  }
  isAdmin() {
    return this.user$.value?.role === 'ADMIN'
  }
  isDentist() {
    return this.user$.value?.role === 'DENTIST'
  }
  isUser() {
    return this.user$.value?.role === 'USER'
  }
  logout() {
    this.accessToken$.next(null)
    this.refreshToken = null
    this.user$.next(null)
    this.access$.next(null)
    this.accessLoaded = false
    this.accessRequest$ = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('tenant')
    localStorage.removeItem('accessPermissions')
  }

  private resetAccess(user: User) {
    const access: AccessSnapshot = { role: user.role, permissions: [...DEFAULT_PERMISSIONS[user.role]] }
    this.access$.next(access)
    this.accessLoaded = false
    localStorage.setItem('accessPermissions', JSON.stringify(access))
  }
}
