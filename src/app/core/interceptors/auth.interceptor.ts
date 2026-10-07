import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LoginResponse } from '../interfaces/Login';

/**
 * The refresh currently in flight, so a screenful of requests that all expire
 * at once asks the server one question rather than twenty.
 *
 * It is cleared when that question is answered, whichever way it is answered.
 * It used to be a boolean beside a subject that only ever published a token:
 * a refusal published nothing, so every request waiting behind it waited for
 * the rest of the session. That is what a tab left open overnight ran into --
 * it was not slow, it was never coming back.
 */
let refreshing: Observable<string | null> | null = null;

/** A refresh that never answers must not take the tab down with it. */
const REFRESH_TIMEOUT_MS = 20_000;

/** True while the app is already on its way to the login page. */
let leaving = false;

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
  const backend = inject(HttpBackend);
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
      // On the server there is nobody to log in again, and a thrown refresh
      // would take the render down with it.
      if (error.status === 401 && isBrowser && !cloned.url.includes('/auth/')) {
        return handle401Error(cloned, next, backend, router, authService);
      }

      return throwError(() => error);
    })
  );
};

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  backend: HttpBackend,
  router: Router,
  authService: AuthService
): Observable<never> | ReturnType<HttpHandlerFn> {
  return refreshToken(backend, authService).pipe(
    switchMap((fresh) => {
      if (!fresh) {
        endSession(authService, router);

        // Thrown rather than swallowed: a request that completes without an
        // answer leaves whoever asked it waiting for one. Spinners spin, a
        // poller's "one at a time" guard never reopens, and the tab fills up
        // with requests that will never finish. The error interceptor stays
        // quiet on a 401, so this costs no toast.
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 401,
              statusText: 'Your session has ended',
              url: req.url,
            })
        );
      }

      return next(
        req.clone({
          withCredentials: true,
          setHeaders: { Authorization: `Bearer ${fresh}` },
        })
      );
    })
  );
}

/**
 * Asks for a new access token, once, however many callers are asking.
 *
 * Sent through the backend rather than the ordinary client so it does not
 * pass back through this interceptor: a refusal here is an answer, and it
 * must reach the code waiting for it rather than being handled a second time
 * as another expired request.
 */
function refreshToken(backend: HttpBackend, authService: AuthService): Observable<string | null> {
  refreshing ??= new HttpClient(backend)
    .post<LoginResponse>(`${apiUrl()}/auth/refresh`, {}, { withCredentials: true })
    .pipe(
      timeout(REFRESH_TIMEOUT_MS),
      map((response) => response.accessToken || null),
      tap((fresh) => {
        if (fresh) {
          authService.setAccessToken(fresh);
        }
      }),

      // Every failure is the same answer: no token. Said plainly here so that
      // nothing downstream has to tell a refusal from a timeout from a
      // network that went away with the laptop lid.
      catchError(() => of(null)),
      finalize(() => {
        refreshing = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  return refreshing;
}

/** Signs out and sends the person to the login page, once per expiry. */
function endSession(authService: AuthService, router: Router): void {
  if (leaving) {
    return;
  }

  leaving = true;
  authService.logout();

  const returnUrl = router.url && !router.url.startsWith('/login') ? router.url : '/dashboard';
  router.navigate(['/login'], { queryParams: { returnUrl } }).finally(() => {
    leaving = false;
  });
}

/** The base URL is per-browser and changeable from Settings. */
function apiUrl(): string {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('lms_api_url') : null;
  return stored || 'https://mv-api.inite.tech/api';
}
