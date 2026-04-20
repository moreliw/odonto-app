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
          <img src="/assets/logo.svg" alt="Odonto" height="28" />
          <span class="brand-name" style="font-weight: 700; font-size: 16px; color: var(--text);">Super Admin</span>
        </div>
        <nav class="sidebar-nav">
          <p class="nav-section-title">PLATAFORMA</p>
          <a routerLink="/admin/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            <span class="nav-dot"></span>
            <span>Visão geral</span>
          </a>
          <a routerLink="/admin/empresas" routerLinkActive="active">
            <span class="nav-dot"></span>
            <span>Empresas</span>
          </a>
          <a routerLink="/admin/financeiro" routerLinkActive="active">
            <span class="nav-dot"></span>
            <span>Financeiro</span>
          </a>
          <a routerLink="/admin/operacional" routerLinkActive="active">
            <span class="nav-dot"></span>
            <span>Operacional</span>
          </a>
        </nav>
        <div class="sidebar-footer">
          <div class="user-profile">
            <div class="avatar">{{ initials }}</div>
            <div class="user-info">
              <strong>{{ displayName }}</strong>
              <small>Super administrador</small>
            </div>
          </div>
          <button class="btn-logout" type="button" (click)="logout()" aria-label="Sair">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </aside>
      <main class="content">
        <header class="topbar">
          <button class="btn btn-icon" type="button" (click)="toggleSidebar()" aria-label="Alternar menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <span class="topbar-chip">Acesso total · operações e finanças</span>
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
    if (typeof localStorage !== 'undefined') localStorage.setItem('sidebarCollapsed', this.collapsed ? 'true' : 'false')
  }

  logout() {
    this.master.logout()
    this.router.navigateByUrl('/admin/login')
  }
}
