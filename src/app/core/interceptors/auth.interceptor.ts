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

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<boolean | null>(null);

/**
 * Authentication interceptor that:
 * 1. Attaches `withCredentials: true` to all outgoing API requests.
 * 2. Automatically intercepts 401 Unauthorized errors and triggers a silent
 *    token refresh (`POST /api/auth/refresh`), retrying the failed request seamlessly.
 * 3. Redirects to `/auth/login` if refresh fails or token is expired.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const http = inject(HttpClient);

  // Ensure auth cookies (LMSAuth / LMSRefresh) are included with every request
  const cloned = req.withCredentials ? req : req.clone({ withCredentials: true });

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 Unauthorized occurs on a non-auth endpoint, attempt token refresh
      if (error.status === 401 && !cloned.url.includes('/auth/')) {
        return handle401Error(cloned, next, http, router);
      }

      return throwError(() => error);
    })
  );
};

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  http: HttpClient,
  router: Router
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const apiUrl =
      (typeof window !== 'undefined' ? localStorage.getItem('lms_api_url') : null) ||
      'https://mv-api.inite.tech/api';

    return http.post(`${apiUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
      switchMap(() => {
        isRefreshing = false;
        refreshTokenSubject.next(true);
        // Retry original request with credentials
        return next(req.clone({ withCredentials: true }));
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        refreshTokenSubject.next(false);

        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_user');
        }
        router.navigate(['/auth/login']);
        return throwError(() => refreshError);
      })
    );
  } else {
    // If a refresh is already in progress, wait until it completes then retry
    return refreshTokenSubject.pipe(
      filter((result) => result !== null),
      take(1),
      switchMap((success) => {
        if (success) {
          return next(req.clone({ withCredentials: true }));
        }
        return throwError(() => new Error('Session expired'));
      })
    );
  }
}
