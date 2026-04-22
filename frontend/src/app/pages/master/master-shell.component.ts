import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router'
import { MasterAdminService } from '../../services/master-admin.service'

@Component({
  selector: 'app-master-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="layout" [class.collapsed]="collapsed">
      <aside class="sidebar" role="navigation" aria-label="Menu super admin">
        <div class="sidebar-header">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <div style="width:30px;height:30px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #334155;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <span class="brand-name" style="font-size:14px;">Super Admin</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <p class="nav-section-title">Plataforma</p>

          <a routerLink="/admin/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            <span>Visão geral</span>
          </a>

          <a routerLink="/admin/empresas" routerLinkActive="active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            <span>Empresas</span>
          </a>

          <a routerLink="/admin/financeiro" routerLinkActive="active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <span>Financeiro</span>
          </a>

          <a routerLink="/admin/operacional" routerLinkActive="active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span>Operacional</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="user-profile">
            <div class="avatar admin">{{ initials }}</div>
            <div class="user-info">
              <span class="user-name">{{ displayName }}</span>
              <span class="user-role">Super administrador</span>
            </div>
          </div>
          <button class="btn-logout" type="button" (click)="logout()" aria-label="Sair" title="Sair">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>

      <main class="content">
        <header class="topbar">
          <button class="btn btn-icon" type="button" (click)="toggleSidebar()" aria-label="Alternar menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span class="topbar-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Acesso total · Super Admin
          </span>
          <div class="spacer"></div>
        </header>

        <div class="container master-admin-page">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `
})
export class MasterShellComponent {
  collapsed = false
  displayName = 'Admin'
  initials = 'A'

  constructor(private readonly master: MasterAdminService, private readonly router: Router) {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('sidebarCollapsed') : null
    this.collapsed = stored === 'true'
    const u = this.master.getUser()
    this.displayName = u?.name || u?.email || 'Super administrador'
    this.initials = (this.displayName[0] || 'A').toUpperCase()
  }

  toggleSidebar() {
    this.collapsed = !this.collapsed
    if (typeof localStorage !== 'undefined') localStorage.setItem('sidebarCollapsed', String(this.collapsed))
  }

  logout() {
    this.master.logout()
    this.router.navigateByUrl('/admin/login')
  }
}
