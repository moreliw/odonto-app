import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { BehaviorSubject, of, tap } from 'rxjs'

export type User = { id: string; username?: string | null; email: string; name: string; role: 'ADMIN' | 'USER' | 'DENTIST' }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken$ = new BehaviorSubject<string | null>(null)
  private refreshToken: string | null = null
  private user$ = new BehaviorSubject<User | null>(null)
  constructor(private http: HttpClient) {
    const acc = localStorage.getItem('accessToken')
    const ref = localStorage.getItem('refreshToken')
    const usr = localStorage.getItem('user')
    this.accessToken$.next(acc)
    this.refreshToken = ref
    this.user$.next(usr ? JSON.parse(usr) : null)
  }
  login(identifier: string, password: string) {
    return this.http.post<{ accessToken: string; refreshToken: string; user: User; subdomain?: string; tenant?: string }>(`/api/public/login`, { identifier, password }).pipe(
      tap(res => {
        this.accessToken$.next(res.accessToken)
        this.refreshToken = res.refreshToken
        this.user$.next(res.user)
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
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('tenant')
  }
}
