import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpClient,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LoginResponse } from '../interfaces/Login';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * Authentication interceptor that:
 * 1. Attaches `Authorization: Bearer <accessToken>` header and `withCredentials: true` to API requests.
 * 2. Intercepts 401 Unauthorized errors and triggers a token refresh (`POST /api/auth/refresh`),
 *    updating the JWT access token and retrying the failed request cleanly.
 * 3. Redirects to `/auth/login` if refresh fails or session is invalid.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const authService = inject(AuthService);

  const token = authService.getAccessToken();
  const cloned = req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !cloned.url.includes('/auth/')) {
        return handle401Error(cloned, next, http, router, authService);
      }

      return throwError(() => error);
    })
  );
};

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  http: HttpClient,
  router: Router,
  authService: AuthService
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const apiUrl =
      (typeof window !== 'undefined' ? localStorage.getItem('lms_api_url') : null) ||
      'https://mv-api.inite.tech/api';

    return http.post<LoginResponse>(`${apiUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
      switchMap((res) => {
        isRefreshing = false;
        const newToken = res.accessToken || null;
        if (newToken) {
          authService.setAccessToken(newToken);
        }
        refreshTokenSubject.next(newToken);

        const retryReq = req.clone({
          withCredentials: true,
          setHeaders: { Authorization: `Bearer ${newToken}` },
        });
        return next(retryReq);
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);

        authService.logout();
        const currentUrl = router.url && router.url !== '/login' ? router.url : '/dashboard';
        router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
        return throwError(() => refreshError);
      })
    );
  } else {
    return refreshTokenSubject.pipe(
      filter((result) => result !== null),
      take(1),
      switchMap((newToken) => {
        if (newToken) {
          const retryReq = req.clone({
            withCredentials: true,
            setHeaders: { Authorization: `Bearer ${newToken}` },
          });
          return next(retryReq);
        }
        return throwError(() => new Error('Session expired'));
      })
    );
  }
}
