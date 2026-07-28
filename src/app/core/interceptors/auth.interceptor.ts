import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpClient,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take, EMPTY } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LoginResponse } from '../interfaces/Login';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * Authentication interceptor that:
 * 1. Attaches `Authorization: Bearer <accessToken>` header and `withCredentials: true` to API requests.
 * 2. Intercepts 401 Unauthorized errors and triggers a token refresh (`POST /api/auth/refresh`),
 *    updating the JWT access token and retrying the failed request cleanly.
 * 3. Safely handles SSR (Server-Side Rendering) without throwing uncaughtExceptions in Node.js.
 * 4. Redirects to `/login` if refresh fails or session is invalid.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  const token = authService.getAccessToken();
  const cloned = req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // If /auth/refresh itself returned 401, handle logout cleanly
        if (cloned.url.includes('/auth/refresh')) {
          if (isBrowser) {
            authService.logout();
            router.navigate(['/login']);
          }
          return EMPTY;
        }

        // On server side (SSR), don't attempt refresh or throw uncaught exceptions
        if (!isBrowser) {
          return EMPTY;
        }

        // On client side, attempt refresh for non-auth endpoints
        if (!cloned.url.includes('/auth/')) {
          return handle401Error(cloned, next, http, router, authService, isBrowser);
        }
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
  authService: AuthService,
  isBrowser: boolean
) {
  if (!isBrowser) {
    return EMPTY;
  }

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
      catchError(() => {
        isRefreshing = false;
        refreshTokenSubject.next(null);

        if (isBrowser) {
          authService.logout();
          const currentUrl = router.url && router.url !== '/login' ? router.url : '/dashboard';
          router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
        }
        return EMPTY;
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
        if (isBrowser) {
          authService.logout();
          router.navigate(['/login']);
        }
        return EMPTY;
      })
    );
  }
}
