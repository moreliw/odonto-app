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
          <img src="/assets/logo.svg" alt="Odonto" height="28" />
          <span class="brand-name" style="font-weight: 700; font-size: 18px; color: var(--text);">Odonto Platform</span>
        </div>
        
        <nav class="sidebar-nav">
          <p class="nav-section-title">MENU PRINCIPAL</p>
          
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" aria-label="Dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            <span>Dashboard</span>
          </a>
          
          <a routerLink="/appointments" routerLinkActive="active" aria-label="Agenda">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span>Agenda</span>
          </a>
          
          <a routerLink="/patients" routerLinkActive="active" aria-label="Pacientes">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>Pacientes</span>
          </a>
          
          <a routerLink="/records" routerLinkActive="active" aria-label="Prontuário">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span>Prontuário</span>
          </a>
          
          <div class="nav-divider"></div>
          <p class="nav-section-title">ADMINISTRAÇÃO</p>
          
          <a routerLink="/signup" aria-label="Criar clínica">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <span>Criar clínica</span>
          </a>
        </nav>
        
        <div class="sidebar-footer">
          <div class="user-profile">
            <div class="avatar">{{userName.charAt(0) | uppercase}}</div>
            <div class="user-info">
              <strong>{{userName}}</strong>
              <small>Administrador</small>
            </div>
          </div>
          <button class="btn-logout" (click)="logout()" aria-label="Sair">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </aside>
      
      <main class="content">
        <header class="topbar">
          <button class="btn btn-icon" (click)="toggleSidebar()" aria-label="Alternar menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          
          <div class="spacer"></div>
          
          <div class="topbar-actions">
            <button class="btn btn-icon" aria-label="Buscar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <button class="btn btn-icon" aria-label="Notificações">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </button>
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
  userName = ''
  constructor(private auth: AuthService, private router: Router) {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('sidebarCollapsed') : null
    this.collapsed = stored === 'true'
    const userRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    this.userName = user?.name || user?.email || 'Usuário'
  }
  toggleSidebar() {
    this.collapsed = !this.collapsed
    if (typeof localStorage !== 'undefined') localStorage.setItem('sidebarCollapsed', this.collapsed ? 'true' : 'false')
  }
  logout() {
    this.auth.logout()
    this.router.navigateByUrl('/login')
  }
}
