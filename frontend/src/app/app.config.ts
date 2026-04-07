import { ApplicationConfig, inject } from "@angular/core";
import { provideRouter, Routes, Router } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { LoginComponent } from "./pages/login/login.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { PatientsComponent } from "./pages/patients/patients.component";
import { AppointmentsComponent } from "./pages/appointments/appointments.component";
import { RecordsComponent } from "./pages/records/records.component";
import { SignupComponent } from "./pages/signup/signup.component";
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

export const routes: Routes = [
  { path: "login", component: LoginComponent, canActivate: [guestGuard] },
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
