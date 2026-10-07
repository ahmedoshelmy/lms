import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

const REFRESH_URL = 'https://mv-api.inite.tech/api/auth/refresh';

/**
 * What happens to a tab that was left open until its token went stale.
 *
 * The case that matters is the refusal: a refresh the server turns down used
 * to end every waiting request without an answer, which is not an error
 * anybody handles. Spinners spun, the bell's "one request at a time" guard
 * never reopened, and the only way out was to reload the page.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: { token: string | null; loggedOut: boolean } & Partial<AuthService>;

  beforeEach(() => {
    auth = {
      token: 'stale',
      loggedOut: false,
      getAccessToken(): string | null {
        return auth.token;
      },
      setAccessToken(token: string): void {
        auth.token = token;
      },
      logout(): void {
        auth.loggedOut = true;
      },
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { url: '/schedule', navigate: () => Promise.resolve(true) } },
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('refreshes and retries the request that expired', async () => {
    let body: unknown = null;
    http.get('/api/sessions').subscribe((data) => (body = data));

    backend.expectOne('/api/sessions').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(REFRESH_URL).flush({ accessToken: 'fresh' });

    const retry = backend.expectOne('/api/sessions');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh');
    retry.flush({ ok: true });

    expect(body).toEqual({ ok: true });
    expect(auth.token).toBe('fresh');
  });

  it('fails the request when the refresh is refused, rather than leaving it open', async () => {
    let settled = false;
    let status = 0;

    http.get('/api/sessions').subscribe({
      next: () => (settled = true),
      error: (error) => {
        settled = true;
        status = error.status;
      },
      complete: () => (settled = true),
    });

    backend.expectOne('/api/sessions').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(REFRESH_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(settled).toBe(true);
    expect(status).toBe(401);
    expect(auth.loggedOut).toBe(true);
  });

  it('asks for one refresh however many requests expired together', () => {
    http.get('/api/sessions').subscribe({ error: () => undefined });
    http.get('/api/groups').subscribe({ error: () => undefined });

    backend.expectOne('/api/sessions').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/groups').flush(null, { status: 401, statusText: 'Unauthorized' });

    // One question, not two: expectOne fails outright if the second request
    // started its own refresh.
    backend.expectOne(REFRESH_URL).flush({ accessToken: 'fresh' });

    backend.expectOne('/api/sessions').flush({});
    backend.expectOne('/api/groups').flush({});
  });

  it('can refresh again after a refusal', () => {
    http.get('/api/sessions').subscribe({ error: () => undefined });
    backend.expectOne('/api/sessions').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(REFRESH_URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    // The first refusal used to leave the door shut: nothing afterwards could
    // ask again, so the tab stayed broken until it was reloaded.
    http.get('/api/groups').subscribe({ error: () => undefined });
    backend.expectOne('/api/groups').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(REFRESH_URL).flush({ accessToken: 'fresh' });
    backend.expectOne('/api/groups').flush({});
  });
});
