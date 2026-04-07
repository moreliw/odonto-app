import { HttpInterceptorFn, HttpErrorResponse } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, switchMap } from "rxjs/operators";
import { throwError } from "rxjs";
import { AuthService } from "./auth.service";
import { MasterAdminService } from "./master-admin.service";

function subdomainFromHost(host: string) {
  const h = host.split(":")[0];
  const parts = h.split(".");
  if (parts.length < 3) return "";
  return parts[0];
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
        (err.status === 403 || err.status === 419)
      ) {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
        }
        router.navigateByUrl("/login");
      }
      return throwError(() => err);
    }),
  );
};
