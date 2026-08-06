import { ApplicationConfig, inject } from '@angular/core'
import { provideRouter, Routes, Router } from '@angular/router'
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { LoginComponent } from './pages/login/login.component'
import { DashboardComponent } from './pages/dashboard/dashboard.component'
import { PatientsComponent } from './pages/patients/patients.component'
import { AppointmentsComponent } from './pages/appointments/appointments.component'
import { RecordsComponent } from './pages/records/records.component'
import { TeamComponent } from './pages/team/team.component'
import { BillingComponent } from './pages/billing/billing.component'
import { FinanceComponent } from './pages/finance/finance.component'
import { AuthService } from './services/auth.service'
import { SignupComponent } from './pages/signup/signup.component'
import { SignupSuccessComponent } from './pages/signup/signup-success.component'
import { LandingComponent } from './pages/landing/landing.component'
import { MasterLoginComponent } from './pages/master-login/master-login.component'
import { MasterShellComponent } from './pages/master/master-shell.component'
import { MasterOverviewComponent } from './pages/master/master-overview.component'
import { MasterCompaniesComponent } from './pages/master/master-companies.component'
import { MasterFinanceComponent } from './pages/master/master-finance.component'
import { MasterOperationsComponent } from './pages/master/master-operations.component'
import { MasterUsersComponent } from './pages/master/master-users.component'
import { MasterAuditComponent } from './pages/master/master-audit.component'
import { ShellComponent } from './shell/shell.component'
import { authInterceptor } from './services/auth.interceptor'

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

/** Área de gestão da equipe (cadastrar/editar dentistas) — só o administrador da clínica. */
const adminOnlyGuard = () => {
  const router = inject(Router)
  const auth = inject(AuthService)
  return auth.isAdmin() ? true : router.parseUrl('/app')
}

/** Financeiro da clínica: administrador ou dentista responsável pela própria produção. */
const financeGuard = () => {
  const router = inject(Router)
  const auth = inject(AuthService)
  return auth.isAdmin() || auth.isDentist() ? true : router.parseUrl('/app')
}

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'signup', component: SignupComponent, canActivate: [guestGuard] },
  { path: 'signup/success', component: SignupSuccessComponent },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: 'admin/login',
    component: MasterLoginComponent,
    canActivate: [masterGuestGuard]
  },
  {
    path: 'admin',
    component: MasterShellComponent,
    canActivate: [masterAuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: MasterOverviewComponent },
      { path: 'empresas', component: MasterCompaniesComponent },
      { path: 'usuarios', component: MasterUsersComponent },
      { path: 'financeiro', component: MasterFinanceComponent },
      { path: 'operacional', component: MasterOperationsComponent },
      { path: 'auditoria', component: MasterAuditComponent }
    ]
  },
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardComponent },
      { path: 'patients', component: PatientsComponent },
      { path: 'appointments', component: AppointmentsComponent },
      { path: 'records', component: RecordsComponent },
      { path: 'finance', component: FinanceComponent, canActivate: [financeGuard] },
      { path: 'team', component: TeamComponent, canActivate: [adminOnlyGuard] },
      { path: 'billing', component: BillingComponent, canActivate: [adminOnlyGuard] }
    ]
  },
  { path: 'patients', redirectTo: '/app/patients', pathMatch: 'full' },
  { path: 'appointments', redirectTo: '/app/appointments', pathMatch: 'full' },
  { path: 'records', redirectTo: '/app/records', pathMatch: 'full' },
  { path: 'finance', redirectTo: '/app/finance', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
]

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor]))]
}
