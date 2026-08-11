import { HttpInterceptorFn, HttpErrorResponse } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, switchMap } from "rxjs/operators";
import { throwError } from "rxjs";
import { AuthService } from "./auth.service";
import { MasterAdminService } from "./master-admin.service";

/**
 * Domínios em que o app roda sem subdomínio de tenant real (produção não tem
 * DNS curinga para *.odontoapp.morelidev.com hoje). Sem essa lista, o host
 * "odontoapp.morelidev.com" (3 rótulos) era lido como subdomínio "odontoapp",
 * um tenant que não existe — todo request autenticado voltava 404 "Tenant not
 * found" mesmo com o tenant certo salvo no localStorage.
 */
const APP_BASE_HOSTS = [
  "odontoapp.morelidev.com",
  "odontoapp-dev.morelidev.com",
  "localhost",
];

function subdomainFromHost(host: string) {
  const h = host.split(":")[0].toLowerCase();
  for (const base of APP_BASE_HOSTS) {
    if (h === base) return "";
    if (h.endsWith("." + base)) return h.slice(0, h.length - base.length - 1).split(".")[0];
  }
  return "";
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const master = inject(MasterAdminService);
  const isMasterRoute = req.url.includes("/api/master");
  const token = isMasterRoute ? master.getAccessToken() : auth.getAccessToken();
  let headers = req.headers;
  if (token) headers = headers.set("Authorization", `Bearer ${token}`);
  if (!isMasterRoute) {
    let sub = subdomainFromHost(location.host);
    if (!sub && typeof localStorage !== "undefined")
      sub = localStorage.getItem("tenant") || "";
    if (sub) headers = headers.set("x-tenant", sub);
  }
  return next(req.clone({ headers })).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        if (isMasterRoute) {
          master.logout();
          router.navigateByUrl("/admin/login");
          return throwError(() => err);
        }
        if (
          req.url.includes("/api/public/login") ||
          req.url.includes("/api/auth/refresh")
        ) {
          auth.logout();
          router.navigateByUrl("/login");
          return throwError(() => err);
        }
        if (req.url.includes("/api/public/")) {
          return throwError(() => err);
        }
        return auth.refresh().pipe(
          switchMap((res) => {
            if (!res.accessToken) {
              auth.logout();
              router.navigateByUrl("/login");
              return throwError(() => err);
            }
            let retriedHeaders = req.headers.set(
              "Authorization",
              `Bearer ${res.accessToken}`,
            );
            let tenantSub = subdomainFromHost(location.host);
            if (!tenantSub && typeof localStorage !== "undefined")
              tenantSub = localStorage.getItem("tenant") || "";
            if (tenantSub)
              retriedHeaders = retriedHeaders.set("x-tenant", tenantSub);
            return next(req.clone({ headers: retriedHeaders }));
          }),
          catchError((refreshErr) => {
            auth.logout();
            router.navigateByUrl("/login");
            return throwError(() => refreshErr);
          }),
        );
      }
      if (
        err instanceof HttpErrorResponse &&
        err.status === 402
      ) {
        const msg = err.error?.message;
        if (typeof sessionStorage !== "undefined" && msg) {
          sessionStorage.setItem("authBlockedMessage", String(msg));
        }
        if (!req.url.includes("/api/billing")) {
          router.navigateByUrl("/app/billing");
        }
        return throwError(() => err);
      }
      // 403 é "sem permissão para isto" (papel do usuário, não sessão inválida) — a sessão já foi
      // validada pelo token. Não faz logout nem redireciona: cada tela mostra seu próprio erro
      // (toast). Derrubar a sessão inteira aqui já quebrou telas legítimas para papéis não-admin
      // (ex.: equipe de apoio na Agenda) sempre que uma chamada secundária batia em algo admin-only.
      return throwError(() => err);
    }),
  );
};
