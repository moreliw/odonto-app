import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { BehaviorSubject, tap } from 'rxjs'

type MasterAdminUser = {
  email: string
  name: string
  role: 'MASTER_ADMIN'
}

@Injectable({ providedIn: 'root' })
export class MasterAdminService {
  private accessToken$ = new BehaviorSubject<string | null>(null)
  private user$ = new BehaviorSubject<MasterAdminUser | null>(null)

  constructor(private readonly http: HttpClient) {
    const token = localStorage.getItem('masterAccessToken')
    const user = localStorage.getItem('masterUser')
    this.accessToken$.next(token)
    this.user$.next(user ? JSON.parse(user) : null)
  }

  login(email: string, password: string) {
    return this.http.post<{ accessToken: string; user: MasterAdminUser }>('/api/master/auth/login', { email, password }).pipe(
      tap(res => {
        this.accessToken$.next(res.accessToken)
        this.user$.next(res.user)
        localStorage.setItem('masterAccessToken', res.accessToken)
        localStorage.setItem('masterUser', JSON.stringify(res.user))
      })
    )
  }

  getAccessToken() {
    return this.accessToken$.value
  }

  getUser() {
    return this.user$.value
  }

  logout() {
    this.accessToken$.next(null)
    this.user$.next(null)
    localStorage.removeItem('masterAccessToken')
    localStorage.removeItem('masterUser')
  }
}
