import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '../interfaces/Role';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';

describe('AuthService.login', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('signs in against the API, with cookies, and remembers the user', () => {
    const auth = TestBed.inject(AuthService);

    auth.login({ email: 'a@b.c', password: 'secret' }).subscribe();
    const req = http.expectOne('https://mv-api.inite.tech/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ email: 'a@b.c', password: 'secret' });
    req.flush({ id: 4, name: 'Mona', email: 'a@b.c', role: 'Instructor', accessToken: 't' });

    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.currentRole()).toBe(Role.Instructor);
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)!).id).toBe(4);
  });
});
