import { ApplicationConfig, inject } from '@angular/core'
import { provideRouter, Routes, Router } from '@angular/router'
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { AuthService } from './services/auth.service'
// Única página no pacote inicial; as demais entram por loadComponent nas rotas.
import { LandingComponent } from './pages/landing/landing.component'
import { authInterceptor } from './services/auth.interceptor'
import { map } from 'rxjs'
import { PermissionKey } from './models/access-control.model'

const authGuard = () => {
  const router = inject(Router)
  if (typeof localStorage === 'undefined') return router.parseUrl('/login')
  const token = localStorage.getItem('accessToken')
  return token ? true : router.parseUrl('/login')
}

const guestGuard = () => {
  const router = inject(Router)
  if (typeof localStorage === 'undefined') return true
  const token = localStorage.getItem('accessToken')
  return token ? router.parseUrl('/app') : true
}

const masterAuthGuard = () => {
  const router = inject(Router)
  if (typeof localStorage === 'undefined') return router.parseUrl('/admin/login')
  const token = localStorage.getItem('masterAccessToken')
  return token ? true : router.parseUrl('/admin/login')
}

const masterGuestGuard = () => {
  const router = inject(Router)
  if (typeof localStorage === 'undefined') return true
  const token = localStorage.getItem('masterAccessToken')
  return token ? router.parseUrl('/admin/dashboard') : true
}

/** Área restrita ao administrador da clínica (ex.: plano e assinatura). */
const adminOnlyGuard = () => {
  const router = inject(Router)
  const auth = inject(AuthService)
  return auth.isAdmin() ? true : router.parseUrl('/app')
}

/** Financeiro depende da política configurada pelo administrador da clínica. */
const financeGuard = () => {
  const router = inject(Router)
  const auth = inject(AuthService)
  return auth.ensurePermissions().pipe(map(() => auth.hasPermission('FINANCE_VIEW') ? true : router.parseUrl('/app/profile')))
}

const permissionGuard = (permission: PermissionKey) => () => {
  const router = inject(Router)
  const auth = inject(AuthService)
  return auth.ensurePermissions().pipe(map(() => auth.hasPermission(permission) ? true : router.parseUrl('/app/profile')))
}

/**
 * Só a landing entra no pacote inicial. Todo o resto é carregado sob demanda,
 * para que quem abre "/" no celular não baixe agenda, prontuário, financeiro,
 * equipe nem o painel master junto — eram ~20 componentes no mesmo main.js.
 *
 * A landing fica eager de propósito: é a porta de entrada e a página que
 * precisa aparecer rápido, então não vale pagar uma ida e volta a mais nela.
 */
export const routes: Routes = [
  { path: '', component: LandingComponent },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.component').then(m => m.SignupComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'signup/success',
    loadComponent: () => import('./pages/signup/signup-success.component').then(m => m.SignupSuccessComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'confirmar/:subdomain/:token',
    loadComponent: () =>
      import('./pages/confirm-appointment/confirm-appointment.component').then(m => m.ConfirmAppointmentComponent)
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/master-login/master-login.component').then(m => m.MasterLoginComponent),
    canActivate: [masterGuestGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/master/master-shell.component').then(m => m.MasterShellComponent),
    canActivate: [masterAuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/master/master-overview.component').then(m => m.MasterOverviewComponent)
      },
      {
        path: 'empresas',
        loadComponent: () => import('./pages/master/master-companies.component').then(m => m.MasterCompaniesComponent)
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./pages/master/master-users.component').then(m => m.MasterUsersComponent)
      },
      {
        path: 'financeiro',
        loadComponent: () => import('./pages/master/master-finance.component').then(m => m.MasterFinanceComponent)
      },
      {
        path: 'operacional',
        loadComponent: () => import('./pages/master/master-operations.component').then(m => m.MasterOperationsComponent)
      },
      {
        path: 'auditoria',
        loadComponent: () => import('./pages/master/master-audit.component').then(m => m.MasterAuditComponent)
      }
    ]
  },
  {
    path: 'app',
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [permissionGuard('DASHBOARD_VIEW')]
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'patients/:id',
        loadComponent: () =>
          import('./pages/patients/patient-details/patient-details.component').then(m => m.PatientDetailsComponent),
        canActivate: [permissionGuard('PATIENTS_VIEW')]
      },
      {
        path: 'patients',
        loadComponent: () => import('./pages/patients/patients.component').then(m => m.PatientsComponent),
        canActivate: [permissionGuard('PATIENTS_VIEW')]
      },
      {
        path: 'appointments',
        loadComponent: () => import('./pages/appointments/appointments.component').then(m => m.AppointmentsComponent),
        canActivate: [permissionGuard('APPOINTMENTS_VIEW')]
      },
      {
        path: 'records',
        loadComponent: () => import('./pages/records/records.component').then(m => m.RecordsComponent),
        canActivate: [permissionGuard('RECORDS_VIEW')]
      },
      {
        path: 'finance',
        loadComponent: () => import('./pages/finance/finance.component').then(m => m.FinanceComponent),
        canActivate: [financeGuard]
      },
      {
        path: 'fiscal',
        loadComponent: () => import('./pages/fiscal/fiscal.component').then(m => m.FiscalComponent),
        canActivate: [permissionGuard('FISCAL_VIEW')]
      },
      {
        path: 'team',
        loadComponent: () => import('./pages/team/team.component').then(m => m.TeamComponent),
        canActivate: [permissionGuard('TEAM_VIEW')]
      },
      {
        path: 'access',
        loadComponent: () =>
          import('./pages/access-control/access-control.component').then(m => m.AccessControlComponent),
        canActivate: [permissionGuard('ACCESS_MANAGE')]
      },
      {
        path: 'billing',
        loadComponent: () => import('./pages/billing/billing.component').then(m => m.BillingComponent),
        canActivate: [adminOnlyGuard]
      }
    ]
  },
  { path: 'patients', redirectTo: '/app/patients', pathMatch: 'full' },
  { path: 'appointments', redirectTo: '/app/appointments', pathMatch: 'full' },
  { path: 'records', redirectTo: '/app/records', pathMatch: 'full' },
  { path: 'finance', redirectTo: '/app/finance', pathMatch: 'full' },
  { path: 'fiscal', redirectTo: '/app/fiscal', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
]

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor]))]
}
