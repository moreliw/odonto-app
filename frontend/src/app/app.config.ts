import { ApplicationConfig, inject } from "@angular/core";
import { provideRouter, Routes, Router } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { LoginComponent } from "./pages/login/login.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { PatientsComponent } from "./pages/patients/patients.component";
import { AppointmentsComponent } from "./pages/appointments/appointments.component";
import { RecordsComponent } from "./pages/records/records.component";
import { SignupComponent } from "./pages/signup/signup.component";
import { MasterLoginComponent } from "./pages/master-login/master-login.component";
import { MasterShellComponent } from "./pages/master/master-shell.component";
import { MasterOverviewComponent } from "./pages/master/master-overview.component";
import { MasterCompaniesComponent } from "./pages/master/master-companies.component";
import { MasterFinanceComponent } from "./pages/master/master-finance.component";
import { MasterOperationsComponent } from "./pages/master/master-operations.component";
import { ShellComponent } from "./shell/shell.component";
import { authInterceptor } from "./services/auth.interceptor";

const authGuard = () => {
  const router = inject(Router);
  if (typeof localStorage === "undefined") return router.parseUrl("/login");
  const token = localStorage.getItem("accessToken");
  return token ? true : router.parseUrl("/login");
};

const guestGuard = () => {
  const router = inject(Router);
  if (typeof localStorage === "undefined") return true;
  const token = localStorage.getItem("accessToken");
  return token ? router.parseUrl("/") : true;
};

const masterAuthGuard = () => {
  const router = inject(Router);
  if (typeof localStorage === "undefined")
    return router.parseUrl("/admin/login");
  const token = localStorage.getItem("masterAccessToken");
  return token ? true : router.parseUrl("/admin/login");
};

const masterGuestGuard = () => {
  const router = inject(Router);
  if (typeof localStorage === "undefined") return true;
  const token = localStorage.getItem("masterAccessToken");
  return token ? router.parseUrl("/admin/dashboard") : true;
};

export const routes: Routes = [
  { path: "login", component: LoginComponent, canActivate: [guestGuard] },
  {
    path: "admin/login",
    component: MasterLoginComponent,
    canActivate: [masterGuestGuard],
  },
  {
    path: "admin",
    component: MasterShellComponent,
    canActivate: [masterAuthGuard],
    children: [
      { path: "", pathMatch: "full", redirectTo: "dashboard" },
      { path: "dashboard", component: MasterOverviewComponent },
      { path: "empresas", component: MasterCompaniesComponent },
      { path: "financeiro", component: MasterFinanceComponent },
      { path: "operacional", component: MasterOperationsComponent },
    ],
  },
  {
    path: "",
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: "", component: DashboardComponent },
      { path: "signup", component: SignupComponent },
      { path: "patients", component: PatientsComponent },
      { path: "appointments", component: AppointmentsComponent },
      { path: "records", component: RecordsComponent },
    ],
  },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
