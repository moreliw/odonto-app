import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router'
import { AuthService } from '../services/auth.service'

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrador', DENTIST: 'Dentista', USER: 'Equipe' }

@Component({
    selector: 'app-shell',
    imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
    template: `
    <div class="layout" [class.collapsed]="collapsed">
      <aside class="sidebar" role="navigation" aria-label="Menu lateral">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <img
              class="sidebar-brand-mark"
              src="assets/logo-mark-96.png"
              srcset="assets/logo-mark-96.png 1x, assets/logo-mark-192.png 2x"
              width="30" height="30" alt="" aria-hidden="true" decoding="async"
            />
            <span class="brand-name">Odonto<strong>App</strong></span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <p class="nav-section-title">Principal</p>

          <a routerLink="/app" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" aria-label="Dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            <span>Dashboard</span>
          </a>

          <a routerLink="/app/appointments" routerLinkActive="active" aria-label="Agenda">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Agenda</span>
          </a>

          <a routerLink="/app/patients" routerLinkActive="active" aria-label="Pacientes">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Pacientes</span>
          </a>

          <a routerLink="/app/records" routerLinkActive="active" aria-label="Prontuário">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Prontuário</span>
          </a>

          @if (canAccessFinance) {
            <a routerLink="/app/finance" routerLinkActive="active" aria-label="Financeiro">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h4M6 9h4M6 15h7"/></svg>
              <span>Financeiro</span>
            </a>
          }

          @if (isAdmin) {
            <p class="nav-section-title">Gestão</p>
            <a routerLink="/app/team" routerLinkActive="active" aria-label="Equipe">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Equipe</span>
            </a>
            <a routerLink="/app/billing" routerLinkActive="active" aria-label="Plano">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              <span>Plano</span>
            </a>
          }
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
          <button class="btn btn-icon topbar-menu-toggle" (click)="toggleSidebar()" aria-label="Alternar menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          <a class="topbar-mobile-brand" routerLink="/app" aria-label="Ir para o início">
            <img src="assets/logo-mark-96.png" width="30" height="30" alt="" aria-hidden="true" />
            <span>Odonto<strong>App</strong></span>
          </a>

          <div class="spacer"></div>

          <div class="topbar-actions">
            <div class="topbar-item">
              <button class="btn btn-icon" aria-label="Notificações">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span class="topbar-badge"></span>
              </button>
            </div>

            <div class="topbar-item">
              <button class="user-menu-trigger" (click)="userMenuOpen = !userMenuOpen" aria-label="Menu do usuário">
                <div class="user-menu-avatar">{{ initial }}</div>
                <span class="user-menu-name">{{ userName }}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="user-menu-chevron"><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              @if (userMenuOpen) {
                <div class="user-menu-panel">
                  <div class="user-menu-panel-head">
                    <div class="user-menu-panel-name">{{ userName }}</div>
                    <div class="user-menu-panel-role">{{ userRole }}</div>
                  </div>
                  <button class="user-menu-logout" (click)="logout()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sair da conta
                  </button>
                </div>
                <div class="user-menu-backdrop" (click)="userMenuOpen=false"></div>
              }
            </div>
          </div>
        </header>

        <div class="container">
          <router-outlet></router-outlet>
        </div>
      </main>

      <nav class="mobile-bottom-nav" aria-label="Navegação principal">
        <a routerLink="/app" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" aria-label="Início">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.8 12 3l9 7.8"/><path d="M5 9.8V21h14V9.8"/><path d="M9 21v-7h6v7"/></svg>
          <span>Início</span>
        </a>
        <a routerLink="/app/appointments" routerLinkActive="active" aria-label="Agenda">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Agenda</span>
        </a>
        <a routerLink="/app/patients" routerLinkActive="active" aria-label="Pacientes">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
          <span>Pacientes</span>
        </a>
        @if (canAccessFinance) {
          <a routerLink="/app/finance" routerLinkActive="active" aria-label="Financeiro">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h4M6 9h4M6 15h7"/></svg>
            <span>Financeiro</span>
          </a>
        } @else {
          <a routerLink="/app/records" routerLinkActive="active" aria-label="Prontuário">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Prontuário</span>
          </a>
        }
        <button type="button" (click)="mobileMoreOpen = !mobileMoreOpen" [class.active]="mobileMoreOpen" [attr.aria-expanded]="mobileMoreOpen" aria-controls="mobile-more-menu" aria-label="Mais opções">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
          <span>Mais</span>
        </button>
      </nav>

      @if (mobileMoreOpen) {
        <button class="mobile-more-backdrop" type="button" (click)="mobileMoreOpen=false" aria-label="Fechar menu"></button>
        <section class="mobile-more-sheet" id="mobile-more-menu" aria-label="Mais opções">
          <div class="mobile-more-handle" aria-hidden="true"></div>
          <div class="mobile-more-user">
            <div class="avatar">{{ initial }}</div>
            <div>
              <strong>{{ userName }}</strong>
              <span>{{ userRole }}</span>
            </div>
          </div>
          <nav>
            @if (canAccessFinance) {
              <a routerLink="/app/records" (click)="mobileMoreOpen=false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Prontuário
              </a>
            }
            @if (isAdmin) {
              <a routerLink="/app/team" (click)="mobileMoreOpen=false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
                Equipe
              </a>
              <a routerLink="/app/billing" (click)="mobileMoreOpen=false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Plano e assinatura
              </a>
            }
            <button type="button" class="mobile-more-logout" (click)="logout()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sair da conta
            </button>
          </nav>
        </section>
      }
    </div>
  `
})
export class ShellComponent {
  collapsed = false
  userMenuOpen = false
  mobileMoreOpen = false
  userName = ''
  userRole = ''
  initial = ''
  isAdmin = false
  canAccessFinance = false

  constructor(private auth: AuthService, private router: Router) {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('sidebarCollapsed') : null
    this.collapsed = stored === 'true'
    const user = this.auth.getUser()
    this.userName = user?.name || user?.email || 'Usuário'
    this.userRole = ROLE_LABEL[user?.role || ''] || 'Equipe'
    this.initial = (this.userName[0] || 'U').toUpperCase()
    this.isAdmin = this.auth.isAdmin()
    this.canAccessFinance = this.isAdmin || this.auth.isDentist()
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
