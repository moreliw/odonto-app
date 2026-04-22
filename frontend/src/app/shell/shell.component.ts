import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router'
import { AuthService } from '../services/auth.service'

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="layout" [class.collapsed]="collapsed">
      <aside class="sidebar" role="navigation" aria-label="Menu lateral">
        <div class="sidebar-header">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <div style="width:30px;height:30px;background:var(--primary);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M12 2c-2 0-4 2-4 4 0 3 1 5 2 7 .5 1 1 2 1 3h2c0-1 .5-2 1-3 1-2 2-4 2-7 0-2-2-4-4-4z"/></svg>
            </div>
            <span class="brand-name">Odonto Platform</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <p class="nav-section-title">Principal</p>

          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" aria-label="Dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            <span>Dashboard</span>
          </a>

          <a routerLink="/appointments" routerLinkActive="active" aria-label="Agenda">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Agenda</span>
          </a>

          <a routerLink="/patients" routerLinkActive="active" aria-label="Pacientes">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Pacientes</span>
          </a>

          <a routerLink="/records" routerLinkActive="active" aria-label="Prontuário">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Prontuário</span>
          </a>

          <div class="nav-divider"></div>
          <p class="nav-section-title">Configurações</p>

          <a routerLink="/signup" routerLinkActive="active" aria-label="Nova clínica">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Nova clínica</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="user-profile">
            <div class="avatar">{{ initial }}</div>
            <div class="user-info">
              <span class="user-name">{{ userName }}</span>
              <span class="user-role">{{ userRole }}</span>
            </div>
          </div>
          <button class="btn-logout" (click)="logout()" aria-label="Sair" title="Sair">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>

      <main class="content">
        <header class="topbar">
          <button class="btn btn-icon" (click)="toggleSidebar()" aria-label="Alternar menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          <div class="spacer"></div>

          <div class="topbar-actions">
            <div style="position:relative;">
              <button class="btn btn-icon" aria-label="Notificações">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span class="topbar-badge"></span>
              </button>
            </div>

            <div style="position:relative;">
              <button
                class="btn btn-icon"
                style="width:auto;padding:4px 10px 4px 6px;gap:8px;border:1px solid var(--border);border-radius:99px;"
                (click)="userMenuOpen = !userMenuOpen"
                aria-label="Menu do usuário"
              >
                <div style="width:26px;height:26px;border-radius:50%;background:var(--primary-100);color:var(--primary-600);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">{{ initial }}</div>
                <span style="font-size:13px;font-weight:500;color:var(--text);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ userName }}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted);flex-shrink:0;"><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              @if (userMenuOpen) {
                <div style="position:absolute;right:0;top:calc(100% + 8px);background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-lg);min-width:180px;z-index:100;padding:6px;animation:modal-in 0.15s ease;">
                  <div style="padding:10px 12px 8px;border-bottom:1px solid var(--border);margin-bottom:4px;">
                    <div style="font-size:13px;font-weight:600;color:var(--text);">{{ userName }}</div>
                    <div style="font-size:12px;color:var(--muted);">{{ userRole }}</div>
                  </div>
                  <button class="btn btn-ghost" style="width:100%;justify-content:flex-start;font-size:13px;gap:8px;padding:8px 10px;color:var(--danger);" (click)="logout()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sair da conta
                  </button>
                </div>
                <div style="position:fixed;inset:0;z-index:99;" (click)="userMenuOpen=false"></div>
              }
            </div>
          </div>
        </header>

        <div class="container">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `
})
export class ShellComponent {
  collapsed = false
  userMenuOpen = false
  userName = ''
  userRole = ''
  initial = ''

  constructor(private auth: AuthService, private router: Router) {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('sidebarCollapsed') : null
    this.collapsed = stored === 'true'
    const user = this.auth.getUser()
    this.userName = user?.name || user?.email || 'Usuário'
    this.userRole = user?.role === 'ADMIN' ? 'Administrador' : 'Dentista'
    this.initial = (this.userName[0] || 'U').toUpperCase()
  }

  toggleSidebar() {
    this.collapsed = !this.collapsed
    if (typeof localStorage !== 'undefined') localStorage.setItem('sidebarCollapsed', String(this.collapsed))
  }

  logout() {
    this.auth.logout()
    this.router.navigateByUrl('/login')
  }
}
