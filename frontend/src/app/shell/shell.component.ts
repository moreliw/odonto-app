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
          <img src="/assets/logo.svg" alt="Odonto" height="24" />
          <span class="brand-name">Odonto Cloud</span>
        </div>
        <nav class="sidebar-nav">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" aria-label="Dashboard"><span class="nav-dot"></span><span>Dashboard</span></a>
          <a routerLink="/appointments" routerLinkActive="active" aria-label="Agenda"><span class="nav-dot"></span><span>Agenda</span></a>
          <a routerLink="/patients" routerLinkActive="active" aria-label="Pacientes"><span class="nav-dot"></span><span>Pacientes</span></a>
          <a routerLink="/records" routerLinkActive="active" aria-label="Prontuário"><span class="nav-dot"></span><span>Prontuário</span></a>
          <a routerLink="/signup" class="cta" aria-label="Criar clínica"><span>Criar clínica</span></a>
        </nav>
        <div class="sidebar-footer">
          <button class="btn btn-outline btn-block" (click)="logout()" aria-label="Sair">Sair</button>
        </div>
      </aside>
      <main class="content">
        <header class="topbar">
          <button class="btn btn-outline" (click)="toggleSidebar()" aria-label="Alternar menu">Menu</button>
          <span class="topbar-chip">Agenda</span>
          <div class="spacer"></div>
          <button class="btn btn-icon" aria-label="Buscar">⌕</button>
          <button class="btn btn-icon" aria-label="Notificações">◉</button>
          <div class="user" aria-label="Usuário logado">{{userName}}</div>
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
