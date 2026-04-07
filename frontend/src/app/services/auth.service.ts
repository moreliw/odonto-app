import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { BehaviorSubject, of, tap } from 'rxjs'

type User = { id: string; username?: string | null; email: string; name: string; role: 'ADMIN' | 'USER' }

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
